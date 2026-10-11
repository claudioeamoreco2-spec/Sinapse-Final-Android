package com.sinapsefinal.leitor;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONTokener;

/** Offline reader and games. Keep the original asset origin so existing saves survive. */
public class MainActivity extends Activity {
    private static final String WEB_STATE = "sinapse.web.state";
    private static final int CHOOSE_JSON = 1001;
    private static final int EXPORT_PROGRESS = 1002;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService documentWriter = Executors.newSingleThreadExecutor();
    private FrameLayout container;
    private WebView webView;
    private TextToSpeech textToSpeech;
    private boolean speechInitialized;
    private boolean speechReady;
    private volatile boolean destroyed;
    private boolean background;
    private boolean showingLoadError;
    private String pendingSpeech;
    private String currentUrl = OfflineAssetPolicy.START_URL;
    private String activeSpeech;
    private int speechSequence;
    private ValueCallback<Uri[]> pendingFileChooser;
    private String pendingBackup;
    private android.window.OnBackInvokedCallback backCallback;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(7, 6, 17));
        setContentView(container);
        applySystemInsets();
        createWebView(savedInstanceState == null ? null : savedInstanceState.getBundle(WEB_STATE));
        initializeVoice();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    private void applySystemInsets() {
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            }
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        container.requestApplyInsets();
    }

    @SuppressWarnings("deprecation")
    private void createWebView(Bundle savedState) {
        if (destroyed) return;
        WebView view = new WebView(this);
        webView = view;
        view.setBackgroundColor(Color.rgb(7, 6, 17));
        WebView.setWebContentsDebuggingEnabled(
                (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); // Bundled android_asset resources remain accessible.
        settings.setAllowContentAccess(true); // User-selected JSON from the system document picker.
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setDefaultTextEncodingName("UTF-8");
        view.addJavascriptInterface(new VoiceBridge(), "AndroidVoice");
        view.addJavascriptInterface(new ContentBridge(), "AndroidContent");
        view.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView source, ValueCallback<Uri[]> callback,
                    FileChooserParams parameters) {
                if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("application/json");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(intent, CHOOSE_JSON); }
                catch (ActivityNotFoundException exception) {
                    pendingFileChooser.onReceiveValue(null);
                    pendingFileChooser = null;
                    Toast.makeText(MainActivity.this, "Nenhum seletor de arquivos disponível.",
                            Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        view.setWebViewClient(new LocalClient());
        container.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (savedState == null || view.restoreState(savedState) == null) view.loadUrl(currentUrl);
        if (background) view.onPause();
    }

    private void initializeVoice() {
        textToSpeech = new TextToSpeech(this, status -> mainHandler.post(() -> {
            if (destroyed || textToSpeech == null) return;
            speechInitialized = true;
            if (status != TextToSpeech.SUCCESS) {
                pendingSpeech = null;
                voiceEvent("error");
                return;
            }
            int language = textToSpeech.setLanguage(new Locale("pt", "BR"));
            speechReady = language != TextToSpeech.LANG_MISSING_DATA
                    && language != TextToSpeech.LANG_NOT_SUPPORTED;
            if (!speechReady) {
                pendingSpeech = null;
                voiceEvent("error");
                return;
            }
            textToSpeech.setSpeechRate(0.92f);
            textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {
                    mainHandler.post(() -> { if (isCurrentSpeech(id)) voiceEvent("reading"); });
                }
                @Override public void onDone(String id) {
                    mainHandler.post(() -> {
                        if (isCurrentSpeech(id) && id.endsWith(":last")) {
                            activeSpeech = null;
                            voiceEvent("done");
                        }
                    });
                }
                @Override public void onError(String id) {
                    mainHandler.post(() -> {
                        if (isCurrentSpeech(id)) {
                            activeSpeech = null;
                            textToSpeech.stop();
                            voiceEvent("error");
                        }
                    });
                }
            });
            if (pendingSpeech != null && !background) {
                String text = pendingSpeech;
                pendingSpeech = null;
                speak(text);
            }
        }));
    }

    private boolean isCurrentSpeech(String id) {
        return !destroyed && activeSpeech != null && id != null
                && id.startsWith(activeSpeech + ":");
    }

    private void speak(String text) {
        if (destroyed || background || text == null || text.trim().isEmpty()) return;
        if (!speechInitialized) { pendingSpeech = text; return; }
        if (!speechReady || textToSpeech == null) { voiceEvent("error"); return; }
        List<String> chunks = SpeechChunks.split(text, TextToSpeech.getMaxSpeechInputLength());
        activeSpeech = "sinapse" + (++speechSequence);
        for (int index = 0; index < chunks.size(); index++) {
            String id = activeSpeech + ":" + index + (index == chunks.size() - 1 ? ":last" : "");
            int status = textToSpeech.speak(chunks.get(index),
                    index == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, id);
            if (status == TextToSpeech.ERROR) {
                activeSpeech = null;
                textToSpeech.stop();
                voiceEvent("error");
                break;
            }
        }
    }

    private void stopVoice() {
        pendingSpeech = null;
        activeSpeech = null;
        if (textToSpeech != null) textToSpeech.stop();
        voiceEvent("done");
    }

    private void voiceEvent(String state) {
        if (destroyed || webView == null) return;
        webView.evaluateJavascript("window.onAndroidVoiceState&&window.onAndroidVoiceState('"
                + state + "')", null);
    }

    private void saveWebState(String event) {
        if (destroyed || webView == null) return;
        webView.evaluateJavascript("(function(){try{if(window.SinapseNativeLifecycle"
                + "&&typeof window.SinapseNativeLifecycle.save==='function')"
                + "window.SinapseNativeLifecycle.save();}finally{document.dispatchEvent(new Event('"
                + event + "',{bubbles:true}));}})()", null);
    }

    private final class VoiceBridge {
        @JavascriptInterface public void speak(String text) {
            mainHandler.post(() -> {
                if (webView != null && OfflineAssetPolicy.isTrustedPage(webView.getUrl()))
                    MainActivity.this.speak(text);
            });
        }
        @JavascriptInterface public void stop() { mainHandler.post(MainActivity.this::stopVoice); }
    }

    private final class ContentBridge {
        /** A fixed bundled file: never accepts arbitrary paths or reads private device files. */
        @JavascriptInterface public String readChapters() {
            if (destroyed) return "[]";
            try (InputStream stream = getAssets().open("chapters.json");
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (output.size() + count > 4 * 1024 * 1024) return "[]";
                    output.write(buffer, 0, count);
                }
                return new String(output.toByteArray(), StandardCharsets.UTF_8);
            } catch (IOException exception) { return "[]"; }
        }

        /** Save through Android's document picker, without broad storage permission. */
        @JavascriptInterface public void exportBackup(String json) {
            mainHandler.post(() -> {
                if (destroyed || background || pendingBackup != null || webView == null
                        || !OfflineAssetPolicy.isTrustedPage(webView.getUrl())) return;
                if (json == null || json.getBytes(StandardCharsets.UTF_8).length > 4 * 1024 * 1024) {
                    exportEvent("error");
                    return;
                }
                try {
                    JSONTokener parser = new JSONTokener(json);
                    Object parsed = parser.nextValue();
                    if (!(parsed instanceof org.json.JSONObject) || parser.nextClean() != 0)
                        throw new JSONException("Expected one JSON object");
                } catch (JSONException exception) { exportEvent("error"); return; }
                pendingBackup = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "Sinapse_Final_Progresso.json");
                try { startActivityForResult(intent, EXPORT_PROGRESS); }
                catch (ActivityNotFoundException exception) {
                    pendingBackup = null;
                    exportEvent("error");
                }
            });
        }
    }

    private void exportEvent(String status) {
        if (destroyed || webView == null) return;
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('sinapse:export',"
                + "{detail:'" + status + "'}))", null);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CHOOSE_JSON && pendingFileChooser != null) {
            Uri selected = resultCode == RESULT_OK && data != null ? data.getData() : null;
            pendingFileChooser.onReceiveValue(selected == null ? null : new Uri[] {selected});
            pendingFileChooser = null;
        } else if (requestCode == EXPORT_PROGRESS) {
            String json = pendingBackup;
            pendingBackup = null;
            Uri target = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (target == null) { exportEvent("cancelled"); return; }
            if (json == null) { exportEvent("error"); return; }
            documentWriter.execute(() -> {
                String status;
                try (java.io.OutputStream output = getContentResolver().openOutputStream(target, "wt")) {
                    if (output == null) throw new IOException("Document provider unavailable");
                    output.write(json.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                    status = "saved";
                } catch (IOException | SecurityException | IllegalArgumentException exception) { status = "error"; }
                String completedStatus = status;
                mainHandler.post(() -> exportEvent(completedStatus));
            });
        }
    }

    private final class LocalClient extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request.getUrl().toString(), request.isForMainFrame());
        }
        @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(url, true);
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view,
                WebResourceRequest request) {
            if (OfflineAssetPolicy.isAssetUrl(request.getUrl().toString())) return null;
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                    java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
        @Override public void doUpdateVisitedHistory(WebView view, String url, boolean reload) {
            if (OfflineAssetPolicy.isTrustedPage(url)) currentUrl = url;
        }
        @Override public void onPageFinished(WebView view, String url) {
            showingLoadError = false;
            if (background) saveWebState("sinapse:pause");
        }
        @Override public void onReceivedError(WebView view, WebResourceRequest request,
                WebResourceError error) {
            if (!request.isForMainFrame() || destroyed || showingLoadError) return;
            showingLoadError = true;
            new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Não foi possível abrir o aplicativo")
                    .setMessage("Seus dados de leitura e jogos permanecem salvos. Tente abrir novamente.")
                    .setPositiveButton("Tentar novamente", (dialog, which) -> view.loadUrl(currentUrl))
                    .setNegativeButton("Fechar", (dialog, which) -> finish()).show();
        }
        @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            releaseWebView(view);
            stopVoice();
            if (!destroyed) {
                mainHandler.post(() -> {
                    if (!destroyed) {
                        createWebView(null);
                        Toast.makeText(MainActivity.this,
                                "O aplicativo foi reaberto. Os últimos dados salvos foram mantidos.",
                                Toast.LENGTH_LONG).show();
                    }
                });
            }
            return true;
        }
    }

    private boolean handleNavigation(String url, boolean mainFrame) {
        if (mainFrame && OfflineAssetPolicy.isTrustedPage(url)) return false;
        if (mainFrame && url != null && url.startsWith("https://")) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch (ActivityNotFoundException exception) {
                Toast.makeText(this, "Nenhum navegador disponível neste aparelho.", Toast.LENGTH_SHORT).show();
            }
        }
        return true;
    }

    @SuppressWarnings("deprecation")
    private void handleBack() {
        if (webView == null) { finish(); return; }
        if (webView.canGoBack()) { stopVoice(); webView.goBack(); return; }
        webView.evaluateJavascript("(function(){if(typeof window.SinapseNativeBack==='function')"
                + "return !!window.SinapseNativeBack();if(location.hash&&location.hash!=='#home'"
                + "&&typeof go==='function'){go('home',{history:false});return true;}return false;})()",
                result -> { if (!destroyed && !"true".equals(result)) finish(); });
    }

    @Override public void onBackPressed() { handleBack(); }

    @Override protected void onResume() {
        super.onResume();
        background = false;
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("document.dispatchEvent(new Event('sinapse:resume',"
                    + "{bubbles:true}))", null);
        }
    }

    @Override protected void onPause() {
        background = true;
        saveWebState("sinapse:pause");
        stopVoice();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        saveWebState("sinapse:save");
        if (webView != null) {
            Bundle webState = new Bundle();
            webView.saveState(webState);
            outState.putBundle(WEB_STATE, webState);
        }
        super.onSaveInstanceState(outState);
    }

    private void releaseWebView(WebView view) {
        if (view == null) return;
        if (webView == view) webView = null;
        if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
        view.destroy();
    }

    @Override protected void onDestroy() {
        destroyed = true;
        pendingSpeech = null;
        pendingBackup = null;
        activeSpeech = null;
        mainHandler.removeCallbacksAndMessages(null);
        documentWriter.shutdown();
        if (pendingFileChooser != null) {
            pendingFileChooser.onReceiveValue(null);
            pendingFileChooser = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backCallback != null)
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        releaseWebView(webView);
        super.onDestroy();
    }
}

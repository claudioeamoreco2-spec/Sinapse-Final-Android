package com.sinapsefinal.leitor;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.JavascriptInterface;
import android.graphics.Color;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;

/** Leitor offline do primeiro capítulo de Sinapse Final. */
public class MainActivity extends Activity {
    private WebView webView;
    private TextToSpeech textToSpeech;
    private String pendingSpeech;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setWebViewClient(new WebViewClient());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setDefaultTextEncodingName("UTF-8");
        webView.addJavascriptInterface(new VoiceBridge(), "AndroidVoice");
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech.setLanguage(new Locale("pt", "BR"));
                textToSpeech.setSpeechRate(0.92f);
                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { voiceEvent("reading"); }
                    @Override public void onDone(String id) { voiceEvent("done"); }
                    @Override public void onError(String id) { voiceEvent("error"); }
                });
                if (pendingSpeech != null) {
                    textToSpeech.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, null, "sinapse");
                    pendingSpeech = null;
                }
            } else voiceEvent("error");
        });
        webView.setBackgroundColor(Color.rgb(7, 6, 17));
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }
    private void voiceEvent(String state) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(
                "window.onAndroidVoiceState&&window.onAndroidVoiceState('" + state + "')", null);
        });
    }
    private class VoiceBridge {
        @JavascriptInterface public void speak(String text) {
            runOnUiThread(() -> {
                if (textToSpeech == null) pendingSpeech = text;
                else textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sinapse");
            });
        }
        @JavascriptInterface public void stop() {
            runOnUiThread(() -> {
                if (textToSpeech != null) textToSpeech.stop();
                voiceEvent("done");
            });
        }
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}

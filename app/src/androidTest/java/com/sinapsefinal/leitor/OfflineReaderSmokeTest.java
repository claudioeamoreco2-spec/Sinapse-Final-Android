package com.sinapsefinal.leitor;

import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Runs on the Android 13/14/15 emulator matrix; checks actual WebView storage and bridges. */
@RunWith(AndroidJUnit4.class)
public class OfflineReaderSmokeTest {
    private WebView findWebView(MainActivity activity) {
        ViewGroup content = activity.findViewById(android.R.id.content);
        ViewGroup container = (ViewGroup) content.getChildAt(0);
        assertTrue("Offline reader WebView not attached", container.getChildAt(0) instanceof WebView);
        return (WebView) container.getChildAt(0);
    }

    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> findWebView(activity).evaluateJavascript(script, value -> {
            result.set(value);
            completed.countDown();
        }));
        assertTrue("WebView did not answer JavaScript", completed.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void waitUntilLoaded(ActivityScenario<MainActivity> scenario) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(25);
        while (System.nanoTime() < deadline) {
            if ("true".equals(evaluate(scenario,
                    "document.readyState==='complete'&&document.body"
                    + "&&document.body.innerText.includes('Sinapse')"
                    + "&&typeof window.AndroidContent==='object'"
                    + "&&window.SinapseApp&&SinapseApp.getChapters().length>=12"
                    + "&&window.NerakarRPG&&!!NerakarRPG.getGame()"))) return;
            Thread.sleep(100);
        }
        fail("Offline reader did not load its bundled content");
    }

    @Test public void bundledChaptersAndNativeBridgesAreAvailableOffline() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitUntilLoaded(scenario);
            assertEquals("true", evaluate(scenario,
                    "JSON.parse(AndroidContent.readChapters()).chapters.length>=12"));
            assertEquals("\"function\"", evaluate(scenario, "typeof AndroidVoice.speak"));
            assertEquals("\"function\"", evaluate(scenario, "typeof AndroidContent.exportBackup"));
            scenario.onActivity(activity -> {
                WebView view = findWebView(activity);
                assertTrue(view.getUrl().startsWith(OfflineAssetPolicy.START_URL));
                assertTrue(view.getSettings().getDomStorageEnabled());
                assertTrue(view.getSettings().getBlockNetworkLoads());
                assertFalse(view.getSettings().getAllowFileAccess());
                assertEquals(35, activity.getApplicationInfo().targetSdkVersion);
            });
        }
    }

    @Test public void progressSurvivesActivityRecreationAndBackground() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            waitUntilLoaded(scenario);
            try {
                evaluate(scenario, "localStorage.setItem('sf2_android_smoke','preserved');"
                        + "document.addEventListener('sinapse:pause',function(){"
                        + "localStorage.setItem('sf2_android_pause_smoke','saved')},{once:true});true");
                scenario.moveToState(Lifecycle.State.CREATED);
                scenario.moveToState(Lifecycle.State.RESUMED);
                assertEquals("\"saved\"", evaluate(scenario,
                        "localStorage.getItem('sf2_android_pause_smoke')"));
                scenario.recreate();
                waitUntilLoaded(scenario);
                assertEquals("\"preserved\"", evaluate(scenario,
                        "localStorage.getItem('sf2_android_smoke')"));
            } finally {
                evaluate(scenario, "localStorage.removeItem('sf2_android_smoke');"
                        + "localStorage.removeItem('sf2_android_pause_smoke');true");
            }
        }
    }
}

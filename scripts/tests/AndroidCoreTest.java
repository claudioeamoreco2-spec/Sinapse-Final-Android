package com.sinapsefinal.leitor;

import java.util.List;

/** Integration checks for the pure helpers used by MainActivity. */
public final class AndroidCoreTest {
    private static int checks;

    private static void expect(boolean condition, String message) {
        checks++;
        if (!condition) throw new AssertionError(message);
    }

    private static void verifyNarration(String text, int maximum) {
        List<String> chunks = SpeechChunks.split(text, maximum);
        expect(String.join("", chunks).equals(text), "Narration text was changed or truncated");
        for (String chunk : chunks) {
            expect(!chunk.isEmpty() && chunk.length() <= maximum, "TTS length exceeded");
            expect(!Character.isHighSurrogate(chunk.charAt(chunk.length() - 1)),
                    "An emoji was split between TTS requests");
            expect(!Character.isLowSurrogate(chunk.charAt(0)), "An emoji lost its first character");
        }
    }

    public static void main(String[] args) {
        expect(OfflineAssetPolicy.isTrustedPage(OfflineAssetPolicy.START_URL), "Start page blocked");
        expect(OfflineAssetPolicy.isTrustedPage(OfflineAssetPolicy.START_URL + "#read"),
                "Reader history fragment blocked");
        expect(OfflineAssetPolicy.isAssetUrl("file:///android_asset/characters/v2/caleb.webp"),
                "Preserved illustration blocked");
        expect(OfflineAssetPolicy.isAssetUrl("file:///android_asset/chapters.json"),
                "Bundled chapter data blocked");
        String[] rejected = {null, "", "https://example.com/index.html",
                "javascript:alert(1)", "content://private/document.json", "file:///sdcard/index.html",
                "file://remote/android_asset/index.html", "file:///android_asset/../private.xml",
                "file:///android_asset/%2e%2e/private.xml", "file:///android_asset/%00index.html",
                "file:///android_asset/%5cprivate.xml", "file:///android_asset/index.html?remote=true"};
        for (String url : rejected) expect(!OfflineAssetPolicy.isAssetUrl(url), "Unsafe URI allowed: " + url);
        expect(!OfflineAssetPolicy.isTrustedPage("file:///android_asset/chapters.json"),
                "Only index.html may expose native bridges");
        expect(SpeechChunks.split(null, 4000).isEmpty(), "Null narration not ignored");
        expect(SpeechChunks.split(" \n\t", 4000).isEmpty(), "Empty narration not ignored");
        String narrative = "Nerakar — aço, sangue e ecos. 🐺 As muralhas resistem.\n".repeat(170);
        verifyNarration(narrative, 4000);
        verifyNarration("a".repeat(10001), 4000);
        verifyNarration("a".repeat(3999) + "🐺" + "fim", 4000);
        for (int maximum = 2; maximum <= 40; maximum++)
            verifyNarration("🛡️Nerakar 🐺🌲 aço\nsangue🏰".repeat(6), maximum);
        boolean invalidLimit = false;
        try { SpeechChunks.split("text", 1); }
        catch (IllegalArgumentException exception) { invalidLimit = true; }
        expect(invalidLimit, "Invalid TTS limit did not fail clearly");
        System.out.println("Android core checks passed: " + checks
                + " assertions (offline asset access and complete Unicode narration).");
    }
}

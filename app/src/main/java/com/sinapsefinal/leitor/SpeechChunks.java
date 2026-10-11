package com.sinapsefinal.leitor;

import java.util.ArrayList;
import java.util.List;

/** Preserve narration text while respecting the Android TTS character limit. */
final class SpeechChunks {
    private SpeechChunks() {}

    static List<String> split(String text, int maximumLength) {
        if (maximumLength < 2) throw new IllegalArgumentException("maximumLength must be >= 2");
        List<String> chunks = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) return chunks;
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(text.length(), start + maximumLength);
            if (end < text.length()) {
                if (Character.isHighSurrogate(text.charAt(end - 1))) end--;
                int minimumBreak = start + (end - start) / 2;
                for (int cursor = end - 1; cursor > minimumBreak; cursor--) {
                    if (Character.isWhitespace(text.charAt(cursor))) {
                        end = cursor + 1;
                        break;
                    }
                }
            }
            chunks.add(text.substring(start, end));
            start = end;
        }
        return chunks;
    }
}

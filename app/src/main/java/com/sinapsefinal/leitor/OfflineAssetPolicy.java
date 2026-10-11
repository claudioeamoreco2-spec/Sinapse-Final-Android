package com.sinapsefinal.leitor;

import java.net.URI;
import java.net.URISyntaxException;

/** Only bundled assets may run inside the WebView that exposes native bridges. */
final class OfflineAssetPolicy {
    static final String START_URL = "file:///android_asset/index.html";

    private OfflineAssetPolicy() {}

    static boolean isAssetUrl(String url) {
        if (url == null) return false;
        try {
            URI uri = new URI(url);
            if (!"file".equals(uri.getScheme()) || uri.getRawQuery() != null) return false;
            if (uri.getAuthority() != null && !uri.getAuthority().isEmpty()) return false;
            String path = uri.getPath();
            if (path == null || !path.startsWith("/android_asset/") || path.indexOf('\\') >= 0
                    || path.indexOf('\0') >= 0) return false;
            for (String part : path.split("/")) {
                if ("..".equals(part) || ".".equals(part)) return false;
            }
            return true;
        } catch (URISyntaxException exception) {
            return false;
        }
    }

    static boolean isTrustedPage(String url) {
        if (!isAssetUrl(url)) return false;
        try {
            return "/android_asset/index.html".equals(new URI(url).getPath());
        } catch (URISyntaxException exception) {
            return false;
        }
    }
}

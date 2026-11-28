package fr.strasdrive.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String REMOVE_TAP_FLASH =
        "(() => {" +
        "if (!document.head) return;" +
        "let style = document.getElementById('strasdrive-native-tap-style');" +
        "if (!style) {" +
        "style = document.createElement('style');" +
        "style.id = 'strasdrive-native-tap-style';" +
        "document.head.appendChild(style);" +
        "}" +
        "style.textContent = 'html, body, body * { -webkit-tap-highlight-color: transparent !important; }';" +
        "})()";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(QrBrightnessPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                webView.evaluateJavascript(REMOVE_TAP_FLASH, null);
            }
        });
        getBridge().getWebView().evaluateJavascript(REMOVE_TAP_FLASH, null);
    }
}

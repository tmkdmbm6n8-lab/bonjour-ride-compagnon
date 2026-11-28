package fr.strasdrive.app;

import android.os.Handler;
import android.os.Looper;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "QrBrightness")
public class QrBrightnessPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable restore = this::restoreBrightness;
    private Float previousBrightness;

    @PluginMethod
    public void start(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!getActivity().hasWindowFocus()) {
                call.resolve();
                return;
            }

            Window window = getActivity().getWindow();
            WindowManager.LayoutParams attributes = window.getAttributes();
            if (previousBrightness == null) previousBrightness = attributes.screenBrightness;
            attributes.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL;
            window.setAttributes(attributes);
            handler.removeCallbacks(restore);
            handler.postDelayed(restore, 5000);
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            restoreBrightness();
            call.resolve();
        });
    }

    @Override
    protected void handleOnPause() {
        restoreBrightness();
    }

    @Override
    protected void handleOnDestroy() {
        restoreBrightness();
    }

    private void restoreBrightness() {
        handler.removeCallbacks(restore);
        if (previousBrightness == null) return;
        Window window = getActivity().getWindow();
        WindowManager.LayoutParams attributes = window.getAttributes();
        attributes.screenBrightness = previousBrightness;
        window.setAttributes(attributes);
        previousBrightness = null;
    }
}

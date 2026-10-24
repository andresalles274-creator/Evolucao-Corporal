package br.com.andre22bodybuilder.evolucaocorporal;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final String HOME =
        "https://andresalles274-creator.github.io/Evolucao-Corporal/";
    private static final int FILE_REQUEST = 1611;
    private static final int DARK = Color.rgb(5, 10, 7);
    private static final int LIME = Color.rgb(98, 255, 54);

    private WebView webView;
    private LinearLayout overlay;
    private ProgressBar spinner;
    private TextView statusText;
    private Button retryButton;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private boolean mainFrameFailed = false;

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(DARK);
        getWindow().setNavigationBarColor(DARK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(DARK);
        // Android 15/16 can enforce edge-to-edge with targetSdk 35.
        // Respect system bars so login fields and navigation stay reachable.
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                    android.view.WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        webView = new WebView(this);
        webView.setBackgroundColor(DARK);
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        overlay = new LinearLayout(this);
        overlay.setGravity(Gravity.CENTER);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setBackgroundColor(DARK);
        overlay.setPadding(dp(26), dp(20), dp(26), dp(20));
        root.addView(overlay, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_evolucao);
        overlay.addView(logo, new LinearLayout.LayoutParams(dp(105), dp(105)));

        TextView title = new TextView(this);
        title.setText("EVOLUÇÃO CORPORAL");
        title.setTextColor(Color.WHITE);
        title.setTextSize(21);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(12);
        overlay.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("ANDRÉ SALLES • CONSULTORIA");
        subtitle.setTextColor(LIME);
        subtitle.setTextSize(12);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(6);
        overlay.addView(subtitle, subtitleParams);

        spinner = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams =
            new LinearLayout.LayoutParams(dp(44), dp(44));
        progressParams.topMargin = dp(36);
        overlay.addView(spinner, progressParams);

        statusText = new TextView(this);
        statusText.setText(getString(R.string.loading));
        statusText.setTextColor(Color.LTGRAY);
        statusText.setTextSize(14);
        statusText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        statusParams.topMargin = dp(18);
        overlay.addView(statusText, statusParams);

        retryButton = new Button(this);
        retryButton.setText(R.string.retry);
        retryButton.setTextColor(DARK);
        retryButton.setBackgroundTintList(
            android.content.res.ColorStateList.valueOf(LIME));
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        retryParams.topMargin = dp(24);
        overlay.addView(retryButton, retryParams);
        retryButton.setVisibility(View.GONE);
        retryButton.setOnClickListener(v -> {
            showLoading();
            webView.loadUrl(HOME);
        });
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view,
                WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme())
                        && "andresalles274-creator.github.io"
                            .equalsIgnoreCase(uri.getHost())
                        && uri.getPath() != null
                        && uri.getPath().startsWith("/Evolucao-Corporal/")) {
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!mainFrameFailed) hideOverlay();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                    WebResourceError error) {
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    showError("Não foi possível conectar. Verifique a internet e tente novamente.");
                }
            }

            @Override
            public void onReceivedHttpError(WebView view,
                    WebResourceRequest request, android.webkit.WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    mainFrameFailed = true;
                    showError("O aplicativo está temporariamente indisponível. Tente novamente.");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                ValueCallback<Uri[]> callback, FileChooserParams params) {
                return openFilePicker(callback, params);
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition,
                mimeType, contentLength) -> openExternal(Uri.parse(url)));

        if (savedInstanceState == null) {
            showLoading();
            webView.loadUrl(HOME);
        } else {
            webView.restoreState(savedInstanceState);
            hideOverlay();
        }
    }

    private void showLoading() {
        overlay.setVisibility(View.VISIBLE);
        spinner.setVisibility(View.VISIBLE);
        retryButton.setVisibility(View.GONE);
        statusText.setText(R.string.loading);
    }

    private void hideOverlay() {
        overlay.setVisibility(View.GONE);
    }

    private void showError(String message) {
        overlay.setVisibility(View.VISIBLE);
        spinner.setVisibility(View.GONE);
        retryButton.setVisibility(View.VISIBLE);
        statusText.setText(message);
    }

    private void openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(this, "Não foi possível abrir este link.",
                Toast.LENGTH_LONG).show();
        }
    }

    private boolean openFilePicker(ValueCallback<Uri[]> callback,
            WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
        }
        fileCallback = callback;
        cameraUri = null;

        Intent contentIntent;
        try {
            contentIntent = params.createIntent();
        } catch (Exception ignored) {
            contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
            contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
            contentIntent.setType("image/*");
        }
        contentIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        ArrayList<Intent> extras = new ArrayList<>();
        String[] accepted = params.getAcceptTypes();
        boolean allowsImages = accepted == null || accepted.length == 0;
        if (accepted != null) {
            for (String accept : accepted) {
                if (accept == null || accept.isEmpty()
                        || accept.contains("image") || accept.equals("*/*")) {
                    allowsImages = true;
                }
            }
        }
        if (allowsImages) {
            Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (camera.resolveActivity(getPackageManager()) != null) {
                try {
                    File pictureDirectory =
                        getExternalFilesDir(Environment.DIRECTORY_PICTURES);
                    if (pictureDirectory == null) pictureDirectory = getCacheDir();
                    File image = File.createTempFile("evolucao_", ".jpg", pictureDirectory);
                    cameraUri = FileProvider.getUriForFile(
                        this, getPackageName() + ".fileprovider", image);
                    camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
                                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    extras.add(camera);
                } catch (IOException | IllegalArgumentException ignored) {
                    cameraUri = null;
                }
            }
        }
        try {
            Intent chooser = Intent.createChooser(contentIntent, "Escolher foto ou arquivo");
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,
                extras.toArray(new Parcelable[0]));
            startActivityForResult(chooser, FILE_REQUEST);
            return true;
        } catch (ActivityNotFoundException exception) {
            callback.onReceiveValue(null);
            fileCallback = null;
            Toast.makeText(this, "Nenhum seletor de arquivos disponível.",
                Toast.LENGTH_LONG).show();
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            Uri[] results =
                WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            if (resultCode == RESULT_OK
                    && (results == null || results.length == 0)
                    && cameraUri != null) {
                results = new Uri[]{cameraUri};
            }
            fileCallback.onReceiveValue(results);
            fileCallback = null;
            cameraUri = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
            return;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}

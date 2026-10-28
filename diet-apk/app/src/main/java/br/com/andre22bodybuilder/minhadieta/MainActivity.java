package br.com.andre22bodybuilder.minhadieta;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.net.URL;
import java.net.HttpURLConnection;

public class MainActivity extends Activity {
    private static final int PICK_DIET = 101;
    private static final int SAVE_DIET = 102;
    private static final int BG = Color.rgb(8, 8, 11);
    private WebView web;
    private String pendingExport = "";

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setBlockNetworkLoads(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 16) {
            s.setAllowFileAccessFromFileURLs(false);
            s.setAllowUniversalAccessFromFileURLs(false);
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript("if(window.requestDietSync)window.requestDietSync()", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new LocalBridge(), "Android");
        web.loadUrl("file:///android_asset/index.html");
    }

    private class LocalBridge {
        private static final String DIET_URL =
            "https://raw.githubusercontent.com/andresalles274-creator/Evolucao-Corporal/minha-dieta-apk/diet-apk/sync/diet.json";

        @JavascriptInterface public void syncDiet() {
            new Thread(() -> {
                HttpURLConnection connection = null;
                try {
                    URL url = new URL(DIET_URL + "?t=" + (System.currentTimeMillis() / 60000L));
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(10000);
                    connection.setReadTimeout(10000);
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setUseCaches(false);
                    int status = connection.getResponseCode();
                    if (status != 200) throw new Exception("HTTP " + status);
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    try (InputStream input = connection.getInputStream()) {
                        byte[] buffer = new byte[4096];
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            output.write(buffer, 0, count);
                            if (output.size() > 200000) throw new Exception("Dieta maior que o limite");
                        }
                    }
                    String json = output.toString("UTF-8");
                    web.post(() -> web.evaluateJavascript(
                        "if(window.receiveDietSync)window.receiveDietSync(" + JSONObject.quote(json) + ")", null));
                } catch (Exception e) {
                    web.post(() -> web.evaluateJavascript(
                        "if(window.receiveDietSyncError)window.receiveDietSyncError()", null));
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }).start();
        }

        @JavascriptInterface public void importDiet() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try {startActivityForResult(intent, PICK_DIET);} catch (Exception e) {toast("Não foi possível abrir seus arquivos.");}
            });
        }
        @JavascriptInterface public void exportDiet(String json) {
            if (json == null || json.length() > 1000000) return;
            pendingExport = json;
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "minha-dieta-backup.json");
                try {startActivityForResult(intent, SAVE_DIET);} catch (Exception e) {toast("Não foi possível salvar o backup.");}
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (requestCode == PICK_DIET) {
            try (InputStream input = getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new Exception("Arquivo não encontrado");
                byte[] buf = new byte[4096]; int len;
                while ((len = input.read(buf)) != -1) {
                    output.write(buf, 0, len);
                    if (output.size() > 1000000) throw new Exception("Arquivo muito grande");
                }
                String json = output.toString("UTF-8");
                web.evaluateJavascript("window.receiveDietImport(" + JSONObject.quote(json) + ")", null);
            } catch (Exception e) {toast("Erro ao abrir arquivo de dieta.");}
        } else if (requestCode == SAVE_DIET) {
            try (OutputStream output = getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new Exception("Não há acesso");
                output.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                output.flush(); toast("Backup salvo com sucesso.");
            } catch (Exception e) {toast("Erro ao salvar backup.");}
        }
    }

    private void toast(String text) {runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show());}
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.post(() -> web.evaluateJavascript(
            "if(window.requestDietSync)window.requestDietSync()", null));
    }

    @Override public void onBackPressed() {if (web != null) web.evaluateJavascript("window.onAndroidBack()", null); else super.onBackPressed();}
}

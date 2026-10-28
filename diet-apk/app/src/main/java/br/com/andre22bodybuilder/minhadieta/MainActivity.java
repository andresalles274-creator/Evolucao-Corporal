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
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new LocalBridge(), "Android");
        web.loadUrl("file:///android_asset/index.html");
    }

    private class LocalBridge {
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
    @Override public void onBackPressed() {if (web != null) web.evaluateJavascript("window.onAndroidBack()", null); else super.onBackPressed();}
}

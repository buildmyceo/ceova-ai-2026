package com.ceova.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.GoogleProvider;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    public static class AndroidDownloaderInterface {
        private final Activity activity;

        public AndroidDownloaderInterface(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void downloadBase64(String base64Data, String filename, String mimeType) {
            try {
                if (base64Data == null || base64Data.isEmpty()) return;
                if (base64Data.contains(",")) {
                    base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
                }
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                String safeFilename = (filename != null && !filename.trim().isEmpty()) 
                        ? filename.trim() 
                        : "download_" + System.currentTimeMillis();
                String safeMime = (mimeType != null && !mimeType.trim().isEmpty()) 
                        ? mimeType.trim() 
                        : "application/octet-stream";

                saveBytesToDownloads(bytes, safeFilename, safeMime);
            } catch (Exception e) {
                e.printStackTrace();
                activity.runOnUiThread(() -> 
                    Toast.makeText(activity, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                );
            }
        }

        @JavascriptInterface
        public void downloadUrl(String url, String filename, String mimeType) {
            try {
                if (url == null || url.trim().isEmpty()) return;
                String safeMime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType.trim() : "application/octet-stream";
                String safeFilename = (filename != null && !filename.trim().isEmpty()) 
                        ? filename.trim() 
                        : URLUtil.guessFileName(url, null, safeMime);

                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle(safeFilename);
                request.setDescription("Downloading file...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeFilename);
                request.setMimeType(safeMime);

                try {
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) {
                        request.addRequestHeader("Cookie", cookie);
                    }
                } catch (Exception ignored) {}

                DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    activity.runOnUiThread(() -> 
                        Toast.makeText(activity, "Downloading: " + safeFilename, Toast.LENGTH_SHORT).show()
                    );
                }
            } catch (Exception e) {
                e.printStackTrace();
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(intent);
                } catch (Exception err) {
                    activity.runOnUiThread(() -> 
                        Toast.makeText(activity, "Download failed", Toast.LENGTH_SHORT).show()
                    );
                }
            }
        }

        private void saveBytesToDownloads(byte[] bytes, String filename, String mimeType) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = activity.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(bytes);
                                os.flush();
                            }
                        }
                    } else {
                        throw new Exception("Unable to create file in MediaStore");
                    }
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File file = new File(dir, filename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(activity, new String[]{file.getAbsolutePath()}, null, null);
                }

                activity.runOnUiThread(() -> 
                    Toast.makeText(activity, "Saved to Downloads: " + filename, Toast.LENGTH_LONG).show()
                );
            } catch (Exception e) {
                e.printStackTrace();
                activity.runOnUiThread(() -> 
                    Toast.makeText(activity, "Error saving file: " + e.getMessage(), Toast.LENGTH_SHORT).show()
                );
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Enable hardware layer for 60-120fps smooth GPU acceleration
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                WebSettings settings = webView.getSettings();
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);

                // Enable native download interface
                AndroidDownloaderInterface downloader = new AndroidDownloaderInterface(this);
                webView.addJavascriptInterface(downloader, "AndroidDownloader");

                // Enable WebView download listener
                webView.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                        downloader.downloadUrl(url, filename, mimetype);
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        try {
            if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && 
                requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
                PluginHandle handle = getBridge().getPlugin("SocialLogin");
                if (handle != null && handle.getInstance() instanceof SocialLoginPlugin) {
                    ((SocialLoginPlugin) handle.getInstance()).handleGoogleLoginIntent(requestCode, data != null ? data : new Intent());
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

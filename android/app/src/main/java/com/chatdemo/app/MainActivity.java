package com.chatdemo.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/**
 * WebView 外壳：加载打包进 assets 的聊天页面，并补齐文件选择、麦克风、
 * 外部链接、下载与返回键等浏览器能力。
 */
public class MainActivity extends Activity {
  private static final int REQUEST_FILE = 1001;
  private static final int REQUEST_AUDIO = 1002;

  private WebView webView;
  private ValueCallback<Uri[]> fileCallback;
  private PermissionRequest audioPermissionRequest;
  private long lastBackPressed = 0;

  /** 让页面里的 target=_blank 链接走 shouldOverrideUrlLoading，交给系统浏览器打开 */
  private static final String LINK_BRIDGE_SCRIPT =
      "(function(){"
          + "if(window.__chatDemoLinkBridge){return;}"
          + "window.__chatDemoLinkBridge=true;"
          + "document.addEventListener('click',function(event){"
          + "var node=event.target;"
          + "while(node&&node!==document){"
          + "if(node.tagName==='A'&&node.href&&node.target==='_blank'){"
          + "event.preventDefault();window.location.href=node.href;return;}"
          + "node=node.parentNode;}},true);"
          + "})();";

  /** 主题变化时同步状态栏与导航栏颜色 */
  private static final String THEME_BRIDGE_SCRIPT =
      "(function(){"
          + "function sync(){"
          + "var dark=document.body&&document.body.hasAttribute('data-ds-dark-theme');"
          + "if(window.AndroidBridge&&window.AndroidBridge.setDarkMode){"
          + "window.AndroidBridge.setDarkMode(!!dark);}}"
          + "if(document.body){"
          + "new MutationObserver(sync).observe(document.body,{attributes:true,"
          + "attributeFilter:['data-ds-dark-theme','class']});}"
          + "sync();})();";

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WebView.setWebContentsDebuggingEnabled(
        (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);

    webView = new WebView(this);
    webView.setLayoutParams(
        new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    webView.setBackgroundColor(Color.WHITE);
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    configureWebView(webView.getSettings());

    webView.setWebViewClient(new Client());
    webView.setWebChromeClient(new Chrome());
    webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
    webView.setDownloadListener(new Downloads());

    setContentView(webView);
    webView.loadUrl("file:///android_asset/index.html");
    applySystemBars(false);
  }

  private void configureWebView(WebSettings settings) {
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setAllowFileAccessFromFileURLs(true);
    settings.setAllowUniversalAccessFromFileURLs(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);
    settings.setSupportMultipleWindows(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setSupportZoom(false);
    settings.setLoadWithOverviewMode(false);
    settings.setUseWideViewPort(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      settings.setAlgorithmicDarkeningAllowed(false);
    }
    CookieManager.getInstance().setAcceptCookie(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    }
  }

  private void applySystemBars(boolean dark) {
    Window window = getWindow();
    int background = dark ? Color.rgb(20, 21, 24) : Color.WHITE;
    window.setStatusBarColor(background);
    View decor = window.getDecorView();
    int flags = decor.getSystemUiVisibility();
    if (dark) {
      flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    } else {
      flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    }
    decor.setSystemUiVisibility(flags);
  }

  private class Client extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      return handleUri(request.getUrl());
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
      return handleUri(Uri.parse(url));
    }

    private boolean handleUri(Uri uri) {
      String scheme = uri.getScheme();
      if (scheme == null) {
        return false;
      }
      if (scheme.equals("file")
          || scheme.equals("about")
          || scheme.equals("data")
          || scheme.equals("blob")
          || scheme.equals("javascript")) {
        return false;
      }
      if (scheme.equals("http") || scheme.equals("https")) {
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
          toast(getString(R.string.no_browser));
        }
        return true;
      }
      return true;
    }

    @Override
    public void onPageFinished(WebView view, String url) {
      view.evaluateJavascript(LINK_BRIDGE_SCRIPT, null);
      view.evaluateJavascript(THEME_BRIDGE_SCRIPT, null);
    }
  }

  private class Chrome extends WebChromeClient {
    @Override
    public boolean onShowFileChooser(
        WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
      if (fileCallback != null) {
        fileCallback.onReceiveValue(null);
      }
      fileCallback = callback;
      Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType("*/*");
      intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
      try {
        startActivityForResult(
            Intent.createChooser(intent, getString(R.string.choose_file)), REQUEST_FILE);
      } catch (ActivityNotFoundException ignored) {
        fileCallback = null;
        toast(getString(R.string.no_file_picker));
        return false;
      }
      return true;
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
      for (String resource : request.getResources()) {
        if (!PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
          continue;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED) {
          request.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
          audioPermissionRequest = request;
          requestPermissions(
              new String[] {Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
        }
        return;
      }
      request.deny();
    }

    @Override
    public void onPermissionRequestCanceled(PermissionRequest request) {
      if (audioPermissionRequest == request) {
        audioPermissionRequest = null;
      }
    }

    @Override
    public boolean onConsoleMessage(ConsoleMessage message) {
      return true;
    }
  }

  @Override
  public void onRequestPermissionsResult(
      int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode != REQUEST_AUDIO || audioPermissionRequest == null) {
      return;
    }
    if (grantResults.length > 0
        && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
      audioPermissionRequest.grant(
          new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
    } else {
      audioPermissionRequest.deny();
    }
    audioPermissionRequest = null;
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == REQUEST_FILE) {
      if (fileCallback == null) {
        return;
      }
      Uri[] uris = null;
      if (resultCode == RESULT_OK && data != null) {
        ClipData clip = data.getClipData();
        if (clip != null) {
          ArrayList<Uri> list = new ArrayList<>();
          for (int index = 0; index < clip.getItemCount(); index++) {
            Uri uri = clip.getItemAt(index).getUri();
            if (uri != null) {
              list.add(uri);
            }
          }
          uris = list.toArray(new Uri[0]);
        } else if (data.getData() != null) {
          uris = new Uri[] {data.getData()};
        }
      }
      fileCallback.onReceiveValue(uris);
      fileCallback = null;
      return;
    }
  }

  /** 返回键：先关弹窗，再退页面，最后双击退出 */
  @Override
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    webView.evaluateJavascript(
        "(function(){"
            + "var dialog=document.querySelector('[role=dialog]');"
            + "if(dialog){document.dispatchEvent(new KeyboardEvent('keydown',"
            + "{key:'Escape',bubbles:true}));return 'dialog';}"
            + "return 'none';})()",
        value -> {
          if (value != null && value.contains("dialog")) {
            return;
          }
          if (webView.canGoBack()) {
            webView.goBack();
            return;
          }
          long now = System.currentTimeMillis();
          if (now - lastBackPressed < 2000) {
            finish();
            return;
          }
          lastBackPressed = now;
          toast(getString(R.string.press_again_to_exit));
        });
  }

  @Override
  protected void onPause() {
    webView.onPause();
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    webView.onResume();
  }

  @Override
  protected void onDestroy() {
    if (webView != null) {
      webView.destroy();
    }
    super.onDestroy();
  }

  private void toast(String message) {
    runOnUiThread(
        () -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
  }

  private class Downloads implements DownloadListener {
    @Override
    public void onDownloadStart(
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType,
        long contentLength) {
      if (url.startsWith("blob:") || url.startsWith("data:")) {
        toast(getString(R.string.export_uses_bridge));
        return;
      }
      try {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.addRequestHeader("User-Agent", userAgent);
        request.setNotificationVisibility(
            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(
            Environment.DIRECTORY_DOWNLOADS,
            URLUtil.guessFileName(url, contentDisposition, mimeType));
        DownloadManager manager = getSystemService(DownloadManager.class);
        manager.enqueue(request);
        toast(getString(R.string.download_started));
      } catch (Exception error) {
        toast(getString(R.string.download_failed));
      }
    }
  }

  /** 页面脚本调用的原生能力 */
  private class Bridge {
    @JavascriptInterface
    public void setDarkMode(boolean dark) {
      runOnUiThread(() -> applySystemBars(dark));
    }

    /** 把导出的 ZIP（base64）写入系统下载目录 */
    @JavascriptInterface
    public void saveBase64(String name, String base64) {
      final String fileName = safeFileName(name);
      final byte[] bytes;
      try {
        bytes = Base64.decode(base64, Base64.DEFAULT);
      } catch (IllegalArgumentException error) {
        toast(getString(R.string.save_failed));
        return;
      }
      new Thread(
              () -> {
                try {
                  String location = writeDownload(fileName, bytes);
                  toast(getString(R.string.saved_to, location));
                } catch (Exception error) {
                  toast(getString(R.string.save_failed));
                }
              })
          .start();
    }
  }

  private static String safeFileName(String name) {
    String cleaned = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    if (cleaned.isEmpty()) {
      cleaned = "chat-export.zip";
    }
    return cleaned.length() > 120 ? cleaned.substring(0, 120) : cleaned;
  }

  private static String mimeOf(String name) {
    String lower = name.toLowerCase();
    if (lower.endsWith(".zip")) {
      return "application/zip";
    }
    if (lower.endsWith(".json")) {
      return "application/json";
    }
    return "application/octet-stream";
  }

  private String writeDownload(String name, byte[] bytes) throws Exception {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContentValues values = new ContentValues();
      values.put(MediaStore.Downloads.DISPLAY_NAME, name);
      values.put(MediaStore.Downloads.MIME_TYPE, mimeOf(name));
      values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
      Uri uri =
          getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) {
        throw new IllegalStateException("cannot create download");
      }
      try (OutputStream output = getContentResolver().openOutputStream(uri)) {
        if (output == null) {
          throw new IllegalStateException("cannot open download");
        }
        output.write(bytes);
      }
      return "Download/" + name;
    }
    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
    if (dir == null) {
      dir = getFilesDir();
    }
    if (!dir.exists() && !dir.mkdirs()) {
      throw new IllegalStateException("cannot create directory");
    }
    File file = new File(dir, name);
    try (FileOutputStream output = new FileOutputStream(file)) {
      output.write(bytes);
    }
    return file.getAbsolutePath();
  }
}

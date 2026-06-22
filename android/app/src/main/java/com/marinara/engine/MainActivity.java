package com.marinara.engine;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String SERVER_URL = BuildConfig.MARINARA_SERVER_URL;
    private static final int RETRY_DELAY_MS = 2000;
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int TERMUX_PERMISSION_REQUEST = 1002;
    private static final String TERMUX_PACKAGE = "com.termux";
    private static final String TERMUX_RUN_COMMAND_PERMISSION = "com.termux.permission.RUN_COMMAND";
    private static final String TERMUX_HOME = "/data/data/com.termux/files/home";
    private static final String TERMUX_BASH = "/data/data/com.termux/files/usr/bin/bash";
    private static final String TERMUX_EXTERNAL_APPS_COMMAND =
            "mkdir -p ~/.termux && grep -qxF 'allow-external-apps=true' ~/.termux/termux.properties 2>/dev/null || echo 'allow-external-apps=true' >> ~/.termux/termux.properties; termux-reload-settings";

    private WebView webView;
    private View splashView;
    private ProgressBar spinner;
    private TextView statusText;
    private ValueCallback<Uri[]> fileUploadCallback;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        // Root layout
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0A0A0F);

        // WebView (hidden initially)
        webView = new WebView(this);
        webView.setVisibility(View.INVISIBLE);
        webView.setBackgroundColor(0xFF0A0A0F);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        // Splash screen overlay
        splashView = buildSplashView();
        root.addView(splashView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        configureWebView();
        tryConnect();
    }

    private View buildSplashView() {
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(0xFF0A0A0F);

        // Vertical center container
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(android.view.Gravity.CENTER);
        container.setPadding(48, 0, 48, 0);

        // Status text
        statusText = new TextView(this);
        statusText.setText("Marinara Engine Android shell\nStart ./start-termux.sh in Termux first.");
        statusText.setTextColor(0xFFCCCCCC);
        statusText.setTextSize(16f);
        statusText.setGravity(android.view.Gravity.CENTER);
        statusText.setPadding(32, 0, 32, 24);
        container.addView(statusText);

        // Spinner
        spinner = new ProgressBar(this);
        spinner.setIndeterminate(true);
        container.addView(spinner);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.VERTICAL);
        actions.setPadding(0, 28, 0, 0);

        Button setupButton = buildActionButton("Start setup in Termux");
        setupButton.setOnClickListener(v -> startTermuxSetup());
        actions.addView(setupButton, buildActionButtonLayoutParams());

        Button termuxButton = buildActionButton("Get Termux");
        termuxButton.setOnClickListener(v -> openTermuxDownload());
        actions.addView(termuxButton, buildActionButtonLayoutParams());

        Button retryButton = buildActionButton("Retry connection");
        retryButton.setOnClickListener(v -> tryConnect());
        actions.addView(retryButton, buildActionButtonLayoutParams());

        container.addView(actions);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = android.view.Gravity.CENTER;
        splash.addView(container, lp);
        return splash;
    }

    private Button buildActionButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(0xFFFFFFFF);
        button.setBackgroundColor(0xFF3A2A46);
        button.setPadding(28, 12, 28, 12);
        return button;
    }

    private LinearLayout.LayoutParams buildActionButtonLayoutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, 12);
        return params;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " MarinaraEngine/Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Keep loopback navigation inside the WebView
                if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
                    return false;
                }
                // Open external links in the default browser
                Intent intent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                startActivity(intent);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url.startsWith(SERVER_URL)) {
                    showWebView();
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Server not ready yet — retry
                retryConnection();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    private void tryConnect() {
        statusText.setText("Connecting to Marinara Engine…\nIf this is your first launch, tap Start setup in Termux.");
        webView.loadUrl(SERVER_URL);
    }

    private void retryConnection() {
        statusText.setText("Waiting for Marinara Engine…\nRun setup in Termux or start ./start-termux.sh, then this shell will load automatically.");
        handler.postDelayed(this::tryConnect, RETRY_DELAY_MS);
    }

    private void showWebView() {
        splashView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void startTermuxSetup() {
        if (!isTermuxInstalled()) {
            statusText.setText("Termux is required for the local Marinara server.\nInstall Termux from F-Droid, then return here.");
            openTermuxDownload();
            return;
        }

        if (!hasTermuxRunCommandPermission()) {
            statusText.setText("Grant Marinara Engine permission to run commands in Termux, then tap Start setup again.");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                requestPermissions(new String[]{TERMUX_RUN_COMMAND_PERMISSION}, TERMUX_PERMISSION_REQUEST);
            }
            return;
        }

        sendTermuxSetupCommand();
    }

    private boolean isTermuxInstalled() {
        try {
            getPackageManager().getPackageInfo(TERMUX_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private boolean hasTermuxRunCommandPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(TERMUX_RUN_COMMAND_PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }

    private void sendTermuxSetupCommand() {
        Intent intent = new Intent();
        intent.setClassName(TERMUX_PACKAGE, "com.termux.app.RunCommandService");
        intent.setAction("com.termux.RUN_COMMAND");
        intent.putExtra("com.termux.RUN_COMMAND_PATH", TERMUX_BASH);
        intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"-lc", buildTermuxSetupCommand()});
        intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", TERMUX_HOME);
        intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
        intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0");
        intent.putExtra("com.termux.RUN_COMMAND_LABEL", "Install / start Marinara Engine");
        intent.putExtra(
                "com.termux.RUN_COMMAND_DESCRIPTION",
                "Installs Git and Node.js in Termux, fetches Marinara Engine, and starts the local server.");

        try {
            startService(intent);
            statusText.setText("Termux setup launched.\nWatch Termux finish installing, then this shell will connect automatically.");
            handler.postDelayed(this::openTermux, 500);
            handler.postDelayed(this::tryConnect, RETRY_DELAY_MS);
        } catch (SecurityException e) {
            showTermuxExternalAppsInstructions();
        } catch (IllegalStateException | ActivityNotFoundException e) {
            statusText.setText("Android blocked the Termux setup launch.\nOpen Termux, run ./start-termux.sh, then return here.");
            openTermux();
        }
    }

    private String buildTermuxSetupCommand() {
        String releaseTag = shellQuote(BuildConfig.MARINARA_RELEASE_TAG);
        return "set -e\n"
                + "pkg update -y\n"
                + "pkg install -y git nodejs\n"
                + "if [ ! -d \"$HOME/Marinara-Engine/.git\" ]; then\n"
                + "  git clone --depth 1 --branch " + releaseTag + " https://github.com/Pasta-Devs/Marinara-Engine.git \"$HOME/Marinara-Engine\" || git clone https://github.com/Pasta-Devs/Marinara-Engine.git \"$HOME/Marinara-Engine\"\n"
                + "fi\n"
                + "cd \"$HOME/Marinara-Engine\"\n"
                + "git fetch --tags origin || true\n"
                + "git checkout -f " + releaseTag + " || true\n"
                + "chmod +x start-termux.sh\n"
                + "./start-termux.sh\n";
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private void showTermuxExternalAppsInstructions() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText("Marinara Termux setup", TERMUX_EXTERNAL_APPS_COMMAND));
            Toast.makeText(this, "Copied Termux permission command", Toast.LENGTH_LONG).show();
        }
        statusText.setText("Termux blocked external setup.\nIn Termux, paste the copied allow-external-apps command, grant Run commands permission, then tap Start setup again.");
        openTermux();
    }

    private void openTermuxDownload() {
        openUri("https://f-droid.org/packages/com.termux/");
    }

    private void openTermux() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(TERMUX_PACKAGE);
        if (launchIntent != null) {
            try {
                startActivity(launchIntent);
            } catch (ActivityNotFoundException ignored) {
                // The status text already explains the next step.
            }
        }
    }

    private void openUri(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) {
            statusText.setText("No browser is available to open " + url);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != TERMUX_PERMISSION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            sendTermuxSetupCommand();
        } else {
            statusText.setText("Run commands permission was not granted.\nGrant it from Android App Info > Permissions, then tap Start setup again.");
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback != null) {
                Uri[] result = (resultCode == RESULT_OK && data != null)
                        ? new Uri[]{data.getData()}
                        : null;
                fileUploadCallback.onReceiveValue(result);
                fileUploadCallback = null;
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}

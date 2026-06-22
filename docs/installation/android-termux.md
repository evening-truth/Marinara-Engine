# Android (Termux) Installation Guide

Marinara Engine runs on Android via [Termux](https://f-droid.org/en/packages/com.termux/), a terminal emulator and Linux environment for Android.

> **Important:** The Android APK is a Termux bootstrap + WebView shell, not a native Android server build. It can help start the Termux setup flow and then opens the local server, but Android still requires the user to install Termux and approve command permissions.

## Prerequisites

Install **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/). Do **not** use the Play Store version — it is outdated and unsupported.

## Installation

### Release APK Bootstrap

1. Download the Android APK from the [latest GitHub Release](https://github.com/Pasta-Devs/Marinara-Engine/releases).
2. Install and open **Marinara Engine**.
3. Tap **Start setup in Termux**.
4. If Termux is missing, install it from F-Droid when prompted, then return to Marinara Engine and tap **Start setup in Termux** again.
5. Grant **Run commands in Termux environment** when Android asks.
6. If Termux blocks external commands, paste the copied `allow-external-apps` command into Termux once, then tap **Start setup in Termux** again.
7. Wait for the Termux launcher to install dependencies, build Marinara Engine, and start the server.
8. Return to **Marinara Engine**. The APK retries until `http://127.0.0.1:7860` is ready.

### Manual Termux Install

Open Termux and run:

```bash
pkg update && pkg install -y git nodejs && git clone https://github.com/Pasta-Devs/Marinara-Engine.git && cd Marinara-Engine && chmod +x start-termux.sh && ./start-termux.sh
```

This one-liner:

1. Updates Termux packages
2. Installs Git and Node.js. Marinara requires Node.js 24 LTS or newer; after installation, run `node -v` to confirm Termux installed `v24` or newer.
3. Clones the Marinara Engine repo
4. Makes the launcher executable
5. Runs the Termux launcher for the first time

The Termux launcher installs dependencies, builds the app, prepares local file-backed storage, and starts the server at `http://127.0.0.1:<PORT>` using the `PORT` value from `.env` or the default `7860`.

> **Note:** The first run takes a few minutes because it builds the app on your device. Subsequent runs are much faster.

After installation, open **<http://127.0.0.1:7860>** in your Android browser, or install the PWA from the "Add to Home Screen" prompt for a more native experience.

## Starting the App Again

After the initial setup, start Marinara Engine by running in Termux:

```bash
cd Marinara-Engine
./start-termux.sh
```

That command checks for updates before starting. If you want to start the already-installed local copy without checking GitHub or applying updates, run:

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

## Android App Shell (APK)

If you want a dedicated home-screen icon that opens Marinara Engine like a native app, see [android/README.md](../../android/README.md). The APK is a Termux bootstrap + WebView wrapper around the Termux-served app. It opens the local server when it is already running and provides setup actions when it is not.

Release-page APK downloads still rely on Termux for the local Linux/Node runtime. The APK reduces the setup dance, but it cannot bypass Android's user-visible install and command-permission prompts.

## Accessing from Another Device

The Termux launcher binds to `0.0.0.0` by default, so the app is already reachable on your local network. See the [FAQ](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) for step-by-step LAN access instructions.

## Updating

The `start-termux.sh` launcher automatically updates Marinara Engine on each run:

1. Fetches the latest code from GitHub into `origin/main`, then fast-forwards normal clones or moves detached release checkouts to that commit
2. Detects whether the checkout changed
3. Temporarily stashes tracked local changes if needed, then reapplies them
4. Reinstalls dependencies and rebuilds when needed
5. Starts the app on the current version

Simply run `./start-termux.sh` to get the latest version each time.

If an update is temporarily broken or you need to stay on the current local copy, run `./start-termux.sh --skip-update` instead. The skip-update command still installs missing dependencies and builds missing output when needed; it only skips the GitHub update check and checkout step.

### In-App Update Check

You can also go to **Settings → Advanced → Updates** and click **Check for Updates** to see whether a new release exists. The in-app **Apply Update** button is disabled by default; to enable it, set `UPDATES_APPLY_ENABLED=true`, set `ADMIN_SECRET`, and save that same secret in **Settings → Advanced → Admin Access**. Otherwise, run `./start-termux.sh` again to let the launcher update and relaunch the app.

If you use the optional Android WebView APK or PWA, **Apply Update** updates the Termux server behind it. Remote browser sessions also need `UPDATES_ALLOW_REMOTE_APPLY=true`; otherwise, stop the Termux launcher and run `./start-termux.sh` again.

---

## See Also

- [Configuration Reference](../CONFIGURATION.md) — environment variables and `.env` setup
- [Troubleshooting](../TROUBLESHOOTING.md) — common issues and fixes

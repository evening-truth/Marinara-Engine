# Marinara Engine Installation

Choose the guide for your platform:

- 🐳 [Container (Docker / Podman) Installation Guide](installation/containers.md) — Docker and Podman deployment (recommended)
- 🪟 [Windows Installation Guide](installation/windows.md) — Windows installer or run from source
- 🍎🐧 [macOS / Linux Installation Guide](installation/macos-linux.md) — run from source on macOS and Linux
- 🤖 [Android (Termux) Installation Guide](installation/android-termux.md) — run on Android via Termux
- 📱 [iOS / iPadOS PWA Guide](installation/ios-pwa.md) — open a hosted Marinara server from Safari

> **Android APK note:** Release APKs are Termux bootstrap + WebView shells, not native Android server builds. They can download and hand Termux to Android's installer, then launch the Termux setup flow and open the local server, but Android still requires visible install and command-permission prompts.

Each guide includes installation steps and the relevant update instructions for that platform.

- ⬆️ [Upgrading to v2.0.0](UPGRADING.md) — platform-by-platform path from v1.6.1 or older installs
- 📖 [Configuration Reference](CONFIGURATION.md) — environment variables and `.env` setup
- ❓ [FAQ](FAQ.md) — frequently asked questions (LAN access, etc.)
- 🎓 [Professor Mari](PROFESSOR_MARI.md) — built-in assistant capabilities and limits
- 🔧 [Troubleshooting](TROUBLESHOOTING.md) — common issues and fixes

# KritiCut – on-device video editor

Everything runs on the phone (no server, no database). Media and the project are stored in the browser/app storage.

## Test in a browser
Serve the `www` folder over HTTP: `cd www && python3 -m http.server 8080`, then open http://localhost:8080 (use Chrome).

## Expo Go preview
This project now includes a lightweight Expo wrapper that loads the existing web app inside a native WebView. Run:
```
cd "D:\AI Apps\Video editing app\KritiCut-native-app-v3\kriticut"
& "C:\Program Files\nodejs\npx.cmd" expo start --lan --clear --port 8081
```
Keep that Expo command running in one PowerShell window. In a second PowerShell window, run:
```
cd "D:\AI Apps\Video editing app\KritiCut-native-app-v3\kriticut"
py -m http.server 8080 --directory .\www
```
Keep both commands running. Open the project in Expo Go on the same Wi‑Fi network and scan the QR code from the Expo terminal. The wrapper defaults to `http://192.168.1.68:8080`; replace the IP in the app with your computer's current Wi‑Fi IPv4 address if it changes. If the app cannot connect, allow Python through Windows Firewall on private networks and confirm the web URL opens on your phone's browser.

## Build the Android APK
**Option A – no Android Studio (GitHub):** push this folder to a GitHub repo, open Actions > "Build APK" > Run workflow, download the `KritiCut-debug-apk` artifact, unzip, install `app-debug.apk` on your phone (allow "install unknown apps").

**Option B – locally** (Node 20+, JDK 21, Android Studio/SDK):
```
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```
**Voiceover needs the microphone:** after `npx cap add android`, add `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions to `android/app/src/main/AndroidManifest.xml` (the GitHub workflow does this for you).

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

# KritiCut – on-device video editor

Everything runs on the phone (no server, no database). Media and the project are stored in the browser/app storage.

## Test in a browser
Serve the `www` folder over HTTP: `cd www && python3 -m http.server 8080`, then open http://localhost:8080 (use Chrome).

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

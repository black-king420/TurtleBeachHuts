# Native app builds (optional)

The website is already an installable **PWA** (works on Android, iOS, Windows, macOS, ChromeOS).
Use this folder only if you want a real store/installer build.

## Android / iOS (Capacitor)
```bash
cd native
npm install
npm run cap:add:android      # needs Android Studio  → builds an .apk / .aab
npm run cap:add:ios          # needs a Mac + Xcode   → builds an .ipa
npm run cap:android          # re-sync + open Android Studio after any website change
```

## Windows / macOS / Linux (Electron)
```bash
cd native
npm install
npm run sync-web && npm run desktop     # run it
npm run desktop:build                    # creates an installer in native/dist
```

> Firebase Google/Facebook sign-in popups need extra native setup inside a wrapper
> (Capacitor Firebase Auth plugin). Email/password and Guest sign-in work as-is.

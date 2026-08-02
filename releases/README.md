# Android releases

Generated APK and AAB files are excluded from version control.

Build a directly installable preview APK with:

```powershell
npm run build:apk
```

The file is written to `releases/TaskOrg-<version>-android-preview.apk`. Local previews use Android's debug signing key and must not be uploaded to Google Play. After signing in to Expo/EAS, use `npm run build:aab` for a production store bundle and increment `expo.version` plus `expo.android.versionCode` for each release.

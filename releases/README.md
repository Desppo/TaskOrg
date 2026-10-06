# Mobile releases

Generated APK, AAB, IPA and iOS simulator files are excluded from version control.

## Version 0.5.0

`TaskOrg-0.5.0-android-preview.apk` includes the complete backup section, import preview, reliable note saving, and the simplified Home, Inbox and Tasks screens. Its Android version code is 5 and its application ID remains `com.taskorg.mobile`.

Export your data from the installed version before updating and save the JSON outside TaskOrg. Install the new APK over the existing app without uninstalling it. See the [backup guide](../docs/BACKUPS.md) for recovery and device transfers.

## Build

Build a directly installable preview APK with:

```powershell
npm run build:apk
```

The file is written to `releases/TaskOrg-<version>-android-preview.apk`. Local previews use Android's debug signing key and must not be uploaded to Google Play. After signing in to Expo/EAS, use `npm run build:aab` for a production store bundle and increment `expo.version` plus `expo.android.versionCode` for each release.

For iPhone testing without publishing, use `npm run dev:iphone` and Expo Go; see [the setup guide](../docs/IPHONE.md). For optional native iOS builds, use `npm run build:ios:simulator`, `npm run build:ios:preview` or `npm run build:ipa`. Device builds need Apple Developer signing; increase `expo.ios.buildNumber` for each store upload. EAS provides the download URL after a build completes.

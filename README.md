<p align="center">
  <img src="assets/icon.png" width="128" alt="TaskOrg app icon" />
</p>

# TaskOrg

TaskOrg is a bilingual, local-first mobile planner for **Android and iPhone/iPad**, built for people who want structure without having to design a productivity system first. Capture thoughts immediately, turn them into tasks, focus on the current day, and close the loop with a guided daily review.

[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Highlights

- Frictionless inbox for ideas that are not organized yet.
- **Tasks** view with three clear sections: Today (overdue + due today), Upcoming (future dates grouped by day), and No date.
- Projects with configurable Kanban-style columns.
- Calendar in agenda, week, and month modes.
- Guided daily review: completed work, pending work, and free-form notes.
- Archive with restoration support.
- Spanish and English interfaces, plus system/light/dark themes.
- JSON backup, restore, and double-confirmed data reset.
- Calendar-based date selection, keyboard-aware forms, and safe-area spacing on iPhone.
- No registration, backend, analytics, or cloud dependency at runtime.

## Architecture

```text
Expo Router screens
        │
UI components + providers (language, theme, refresh state)
        │
Typed repositories and backup services
        │
expo-sqlite ── local taskorg.db
```

The app uses Expo Router for file-based navigation and keeps persistence behind repository functions. SQLite migrations run during startup, while React providers contain UI preferences and data refresh coordination. This separation keeps screens focused on interaction instead of SQL or storage details.

| Path | Responsibility |
| --- | --- |
| `app/` | Routes, tabs, forms, settings, archive, and daily review screens |
| `src/components/` | Reusable visual primitives and task form controls |
| `src/data/` | SQLite schema, migrations, repositories, backup and restore |
| `src/providers/` | Language, theme, and data-version state |
| `src/i18n/` | Spanish and English copy |
| `src/theme/` | Shared light and dark design tokens |
| `scripts/` | Reliable LAN startup for Android/iPhone and local Android build automation |
| `tests/` | Real SQLite migration, recurrence, and backup transfer checks |

## Run locally

Requirements: Node.js 22.13+ (including the SQLite test runner), npm 9+, and Expo Go compatible with SDK 54.

```bash
npm ci
npm run dev:lan
```

Scan the QR code from a phone on the same Wi-Fi network. The LAN launcher selects the local IPv4 address, clears Metro's cache, and avoids remote dependency checks during development.

### Try it on your iPhone, without publishing

Install and open Expo Go from the App Store, connect your iPhone and computer to the same Wi-Fi, then run:

```bash
npm run dev:iphone
```

Scan the terminal QR code with the **iPhone Camera**, choose **Open in Expo Go**, and allow local network access if prompted. This works from Windows and does not need Xcode or an Apple Developer membership. Keep the development server running while testing. TaskOrg remains a local-data app; testing in Expo Go does not install a standalone TaskOrg app.

The project intentionally stays on SDK 54, which has an App Store version of Expo Go for physical iPhones. Check [Expo's compatibility instructions](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) before upgrading. For setup, troubleshooting and Android-to-iPhone data transfer, see [the iPhone guide in Spanish](docs/IPHONE.md).

## Quality checks

```bash
npm run type-check
npm test
npm run build
npx expo-doctor
npm audit --omit=dev --audit-level=high
```

`npm run build` exports both iOS and Android JavaScript bundles. You can also use `npm run build:ios` or `npm run build:android`. These exports validate bundling; they do not produce a signed IPA/APK. The GitHub Actions workflow checks TypeScript, database behavior, Expo compatibility, and both bundles on every push and pull request.

The dependency overrides keep Metro packages aligned on 0.83.8 and PostCSS on 8.5.23 for security fixes while retaining SDK 54. [Metro 0.83.8 replaces the affected image parser](https://github.com/react/metro/releases/tag/v0.83.8). Revisit these pins when upgrading Expo.

## Native iOS builds (optional)

Expo generates the native iOS project from `app.json`; generated `ios/` files are excluded from Git. `npm run ios` needs macOS and Xcode. EAS builds can be requested from Windows:

```bash
npm run build:ios:simulator  # simulator only; running it needs a Mac
npm run build:ios:preview    # registered iPhone; Apple Developer signing required
npm run build:ipa            # store-signed IPA for TestFlight/App Store
```

EAS needs an Expo account and project setup on first use. Physical-device EAS builds additionally need Apple Developer credentials. None of these steps are required for the Expo Go path above. The repository contains no signing credentials or automatic publishing.

## Android builds

On a machine with Android Studio installed:

```bash
npm run build:apk
```

This creates a universal, directly installable preview APK in `releases/`. APK files and signing material are intentionally excluded from Git. Production builds use Expo Application Services:

```bash
npm run build:apk:cloud  # internal distribution
npm run build:aab        # Google Play bundle
```

## Privacy and data ownership

All user content is stored in SQLite on the device. TaskOrg does not require an account and does not transmit planner data to a server. Backups are only created when the user explicitly exports them through the system share sheet.

**Settings → Backup → Export all my data** creates a JSON file with all planner tables, including notes, archived content, recurrence history, and language/theme preferences. Save it outside the app before updating or changing devices. Import shows the file's date and record counts before replacing local content. See the [backup and update guide](docs/BACKUPS.md) and the [usability review and improvements](docs/UX-REVIEW.md) (Spanish).

## License

Released under the [MIT License](LICENSE).

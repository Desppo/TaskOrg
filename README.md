<p align="center">
  <img src="assets/icon.png" width="128" alt="TaskOrg app icon" />
</p>

# TaskOrg

TaskOrg is a bilingual, local-first mobile planner built for people who want structure without having to design a productivity system first. Capture thoughts immediately, turn them into tasks, focus on the current day, and close the loop with a guided daily review.

[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Highlights

- Frictionless inbox for ideas that are not organized yet.
- Today view with overdue, scheduled, and unscheduled tasks.
- Projects with configurable Kanban-style columns.
- Calendar in agenda, week, and month modes.
- Guided daily review: completed work, pending work, and free-form notes.
- Archive with restoration support.
- Spanish and English interfaces, plus system/light/dark themes.
- JSON backup, restore, and double-confirmed data reset.
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
| `scripts/` | Reliable LAN startup and local Android build automation |

## Run locally

Requirements: Node.js 20+, npm 9+, and Expo Go compatible with SDK 54.

```bash
npm ci
npm run dev:lan
```

Scan the QR code from a phone on the same Wi-Fi network. The LAN launcher selects the local IPv4 address, clears Metro's cache, and avoids remote dependency checks during development.

## Quality checks

```bash
npm run type-check
npm run build
npx expo-doctor
npm audit --omit=dev --audit-level=high
```

`npm run build` exports the Android JavaScript bundle. The GitHub Actions workflow runs the same static and Expo compatibility checks on every push and pull request.

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

## License

Released under the [MIT License](LICENSE).

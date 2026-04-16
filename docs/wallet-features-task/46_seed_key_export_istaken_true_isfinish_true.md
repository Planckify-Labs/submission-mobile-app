# Task 46 — Seed phrase re-export + private key export (screenshot-guarded)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.11d

## Why this matters

The app currently shows the seed phrase only once at creation. Users need to
re-export it for backup, and export individual private keys for advanced use.
Both must be screenshot-protected.

## Scope

Create:

- `services/security/screenshotGuard.ts`:
  - Android: set `FLAG_SECURE` on the window when sensitive screens are active.
  - iOS: detect screenshot notification via `expo-screen-capture` and show a
    warning alert: "Screenshot detected. Your seed phrase may be compromised."
  - Provide `useScreenshotGuard()` hook that activates on mount, deactivates
    on unmount.
- `app/settings/security/export-seed.tsx` — seed phrase re-export:
  - Requires biometric + PIN (both, sequential).
  - Shows seed words **one at a time** (or in groups of 3), not all at once
    in a screenshot-able grid.
  - Navigation: "Word 1 of 12: apple" → Next → "Word 2 of 12: banana" → …
  - "Copy all" button that copies to clipboard with 60s auto-clear.
  - Screenshot guard active throughout.
- `app/settings/security/export-key.tsx` — private key export:
  - Same auth flow (biometric + PIN).
  - Shows hex private key for the selected wallet.
  - "Copy" button with 60s auto-clear.
  - Screenshot guard active.
- `components/security/SeedExportScreen.tsx` — shared UI component for the
  word-by-word display.

## Rules (non-negotiable)

- **Both biometric AND PIN required** — not either/or. This is the most
  sensitive operation in the app.
- **Never show all 12/24 words at once** — paginated display prevents a single
  screenshot from capturing the full phrase.
- **Clipboard auto-clear after 60s** — use `expo-clipboard` with a timer.
- **Screenshot guard must activate before content renders.**

## Acceptance

- [ ] Export seed requires biometric + PIN (both).
- [ ] Seed words shown one-at-a-time or in small groups.
- [ ] Screenshot guard active on both export screens.
- [ ] Android: `FLAG_SECURE` prevents screenshots.
- [ ] iOS: screenshot detection shows warning.
- [ ] Clipboard auto-clears after 60s.
- [ ] Private key export works for selected wallet.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Cloud backup (task 47).
- Wipe wallet (task 47).

## Depends on

- Task 43 (app lock — for auth flow).

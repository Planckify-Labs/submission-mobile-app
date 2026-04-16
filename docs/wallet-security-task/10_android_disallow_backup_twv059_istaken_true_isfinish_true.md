# Task 10 — `android:allowBackup=false` + `dataExtractionRules`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-059, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

With `android:allowBackup="true"` (Android's historic default),
`adb backup -f backup.ab` extracts `/data/data/<pkg>/` wholesale —
`AsyncStorage` SQLite, SharedPreferences, MMKV, Expo FileSystem — to
a USB-attached attacker with an unlocked device or an enabled
developer-mode handset. OWASP MASVS-STORAGE-1 class, repeatedly seen
in wallet audits. The spec names `app.config.ts` as the surface. §9
"Key custody" row requires `allowBackup=false` and
`dataExtractionRules`; legacy `fullBackupContent` for older APIs also
configured.

## Scope

1. In `app.config.ts`, set `android.allowBackup: false`. Verify the
   compiled `AndroidManifest.xml` reflects it (EAS build artifact).
2. Add `android:dataExtractionRules` (API 31+) with an explicit
   exclude list covering: SecureStore prefs, any wallet-related
   SharedPreferences, MMKV files if present, Expo FileSystem dirs
   under the app's private storage. Reference the ruleset XML from
   `app.config.ts` via the appropriate Expo config path (config
   plugin or `android.extraManifestAttrs` — whichever the current
   Expo version supports).
3. Add `android:fullBackupContent` XML for API <31 with the same
   exclusions; belt-and-suspenders for older handsets still on the
   supported matrix.
4. Repo-wide grep: assert no `AsyncStorage.setItem` / `MMKV.set`
   call ever stores seed, private key, or signing credentials. If
   any found, move to SecureStore and file a follow-up.

## Rules (non-negotiable)

- **`android:allowBackup="false"` is the ground truth.** `adb backup`
  must produce an empty or nearly-empty archive.
- **Wallet material never enters non-SecureStore storage.** Not
  even as a cache, not even transiently serialised to a file.
- **Device-transfer UX stays explicit.** If a user migrates phones,
  they export/import with a user-chosen passphrase — never rely on
  OS backup (§7.1.3, no reset).
- **Build-time verification.** The compiled AndroidManifest.xml is
  inspected in CI (via EAS or a manual checklist) to confirm the
  flag.

## Acceptance

- [ ] `app.config.ts` sets `android.allowBackup: false`.
- [ ] `dataExtractionRules` (API 31+) and `fullBackupContent` (legacy)
      XMLs are present and referenced from `app.config.ts`.
- [ ] Grep confirms zero `AsyncStorage` / `MMKV` calls touching seed,
      private key, or signing credentials.
- [ ] Manual regression on Android device: `adb backup -f test.ab <pkg>`
      yields an empty archive (or one that contains no wallet data).
      Install normally, run wallet, verify all flows.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- iOS keychain accessibility flag — TWV-2026-004 (task 03) and
  TWV-2026-060 (task 11).
- Key Attestation chain validation — TWV-2026-062 (Phase 2, task 34).
- Jailbreak / root detection as advisory surface — TWV-2026-057/058
  (Phase 2/3).

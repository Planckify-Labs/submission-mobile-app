# Task 03 — `WHEN_UNLOCKED_THIS_DEVICE_ONLY` for seed/key items

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-004, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

`expo-secure-store` defaults to `kSecAttrAccessibleAfterFirstUnlock` on
iOS, which (a) keeps the item readable in background after the first
post-boot unlock and (b) leaves it eligible for iCloud/encrypted
backups. MetaMask lost ≥$655k in 2022 to exactly this class — an Apple
ID phish turned into a seed compromise. The spec names
`services/walletService.ts` and `useWallet.ts` as the persistence
sites; the §9 "Key custody" first row requires
`WHEN_UNLOCKED_THIS_DEVICE_ONLY` on every seed/key item.

## Scope

1. Audit every `SecureStore.setItemAsync` / `getItemAsync` /
   `deleteItemAsync` call in the repo that touches seed, private key,
   signing key, or any wallet-credential material. Primary sites named
   in the spec: `services/walletService.ts`, `hooks/useWallet.ts`.
2. Pass `{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }`
   on every such call. A helper wrapper in
   `services/walletService.ts` is acceptable (one call site to review).
3. Add a forward migration: on first launch under the new build, read
   any legacy item written without the flag, rewrite it with the flag,
   then delete the old entry. Never prompt the user to re-import.
4. Add a lint / unit test that fails if a `SecureStore.setItemAsync`
   call is made on a wallet-credential key without the device-only
   accessibility option.

## Rules (non-negotiable)

- **Device-only on every wallet-credential item.** No exceptions for
  "convenience" — iCloud Keychain sync is the attack surface.
- **Migration, not reset (§7.1.3).** Existing users must not lose their
  wallet on the upgrade; the migration path rewrites in place.
- **Helper wrapper is the single write path.** Direct `SecureStore`
  calls for wallet material are prohibited after this task lands.
- **No other `SecureStore` options regress.** If `requireAuthentication`
  is set on a key today, this task does not remove it (that is
  TWV-2026-060's affirmative tightening).

## Acceptance

- [ ] Every SecureStore call in the repo that persists seed / private
      key / signing key passes `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- [ ] A helper (e.g. `secureStoreWalletSet` / `secureStoreWalletGet`)
      centralises the options object; all call sites use it.
- [ ] Forward-migration runs once on upgrade and is idempotent on
      subsequent launches; unit test exercises a legacy-item fixture
      and asserts the rewritten item survives.
- [ ] Manual regression on iOS device: upgrade from the previous build
      with an existing wallet, relaunch, confirm seed still decrypts
      and sign-tx succeeds. Same on Android device.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `android:allowBackup=false` and `dataExtractionRules` — TWV-2026-059
  (task 10).
- `requireAuthentication: true` on every signing read — TWV-2026-060
  (task 11).
- Current-biometric-set invalidation + app-password recovery —
  TWV-2026-061 (task 12).

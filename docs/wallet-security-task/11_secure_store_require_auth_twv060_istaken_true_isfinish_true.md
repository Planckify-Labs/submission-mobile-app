# Task 11 — `requireAuthentication: true` on every signing SecureStore call

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-060, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

iOS Keychain items without `kSecAccessControlBiometryCurrentSet` can
be read by background processes any time the device is in the
"warm" (post-first-unlock) state. A vulnerable app or jailbreak
process can then read signing material without the user ever being
prompted. `expo-secure-store` supports this via
`requireAuthentication: true`. The spec says "add a linter rule
against bare `SecureStore.setItemAsync(key, value)` (require the
options object)"; §9 "Key custody" second row: "SecureStore always
passes `requireAuthentication: true` for signing material."

## Scope

1. Grep the repo for every `SecureStore.{setItemAsync, getItemAsync,
   deleteItemAsync}` call on wallet-credential keys. Primary sites:
   `services/walletService.ts`, `hooks/useWallet.ts`.
2. Pass `{ requireAuthentication: true, authenticationPrompt: '<local
   copy>' }` on every such call. Combine with the
   `WHEN_UNLOCKED_THIS_DEVICE_ONLY` flag from task 03; both options go
   through the shared helper landed there.
3. For non-signing items that happen to live in SecureStore (e.g.
   session tokens, non-sensitive preferences cached there), leave
   `requireAuthentication` unset — we are tightening signing material
   specifically, not causing a biometric prompt every app launch.
4. Add a lint rule (or a test-time AST check) that flags direct
   `SecureStore.setItemAsync(key, value)` usage in the repo — all
   wallet calls must route through the helper.

## Rules (non-negotiable)

- **`requireAuthentication: true` on every signing read.** Seed,
  private key, signing key — biometric prompt required at the OS
  level, not only at the app UI level.
- **Helper is the only call path.** Direct SecureStore on wallet
  material is a merge-block.
- **No double prompts in a single user gesture.** If one UX flow
  reads three keys, the helper caches the biometric session within
  the same authentication window per expo-secure-store semantics
  where permitted.
- **Non-signing SecureStore items are unchanged.** §7.1.2 — no
  unnecessary biometric friction on session-token reads.

## Acceptance

- [ ] Every SecureStore call in the repo that touches seed / private
      key / signing key passes `requireAuthentication: true` through
      the shared helper.
- [ ] Unit/integration test on the helper asserts that calls without
      the option throw (or are blocked at build time).
- [ ] Manual regression on iOS device: sign a tx — a Face ID prompt
      appears (no silent read). Restart the app after first unlock,
      attempt a background Keychain read via a test harness — access
      denied.
- [ ] Manual regression on Android device: Keystore-backed read
      fails without biometric; BiometricPrompt fires as expected.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Current-biometric-set binding + app-password recovery —
  TWV-2026-061 (task 12).
- TEE-enforced biometric gate across the whole app (§9 "Key custody")
  — deeper work in TWV-2026-025 (Phase 3, task 39).
- Moving key plaintext out of JS into a native module —
  TWV-2026-057 (Phase 3).

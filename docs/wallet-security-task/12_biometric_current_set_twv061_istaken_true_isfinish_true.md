# Task 12 — Current-biometric-set binding + app password recovery

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-061, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

A thief who observes the device passcode then steals the phone can
enroll their own Face ID / fingerprint in Settings, then use
biometric-gated wallet operations — because the biometric gate is
tied to the *set* of enrolled biometrics, not a specific face. The
WSJ documented this as "The iPhone Setting Thieves Use." The
correct flag (`kSecAccessControlBiometryCurrentSet` on iOS,
`setInvalidatedByBiometricEnrollment(true)` on Android) invalidates
the Keychain/Keystore item on any biometric change — but this must
be paired with an **app-level password** so the user can recover
after a legitimate biometric re-enrollment. §9 "Key custody" rows
8–9 require both halves.

## Scope

1. In `services/walletService.ts`, ensure SecureStore writes for
   signing material use iOS `kSecAccessControlBiometryCurrentSet`
   semantics via `expo-secure-store`'s
   `authenticationPrompt` + `requireAuthentication: true` (verify
   current-set is the default; if not, document the exact option
   that enforces it).
2. Android side (via `services/walletService.ts` or a new native
   module): generate signing keys with
   `setInvalidatedByBiometricEnrollment(true)` +
   `setUnlockedDeviceRequired(true)`.
3. Add an **app-level password** independent of the device passcode,
   stored as an Argon2id-hashed verifier in SecureStore (not the
   password itself). Use it to recover after biometric invalidation:
   on `BiometricPrompt` or `LAError.InvalidContext` failure, navigate
   to a "biometrics changed — enter app password to continue" screen
   that re-enrolls the biometric after password verification.
4. Add a Settings surface to set / change the app password. On first
   wallet creation, force-create one (users without a recovery path
   are one biometric change away from being locked out).
5. On detection of biometric-set change: wipe any cached session,
   clear in-memory signing state, route to the recovery screen.

## Rules (non-negotiable)

- **Current-set semantics on every signing item.** Biometric change
  invalidates the Keychain/Keystore entry; this is the sole permitted
  forced-re-auth exception in §7.3.
- **App password is required for recovery.** No "skip" path — without
  it, a legitimate biometric change bricks access to signing. Force
  creation at onboarding.
- **Hashed verifier only.** Argon2id (or scrypt with explicit params);
  plain password never stored.
- **Forward migration.** Existing users on upgrade are prompted to set
  an app password; until they do, biometric still works but warning
  banner explains the risk.

## Acceptance

- [ ] SecureStore writes for signing material bind to the current
      biometric set on both platforms.
- [ ] App password creation is part of first-run + Settings; verifier
      is Argon2id-hashed.
- [ ] Biometric-set change callback triggers the recovery screen;
      unit test simulates the callback and asserts routing.
- [ ] Manual regression on iOS device: create wallet, enroll a second
      Face ID in Settings → app prompts for app password on next
      signing attempt. Enter password → signing resumes.
- [ ] Manual regression on Android device: enroll a new fingerprint
      → `BiometricPrompt` fails → recovery screen appears → app
      password unlocks.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- TEE-enforced biometric gate beyond SecureStore — TWV-2026-025
  (Phase 3, task 39).
- Key Attestation chain validation — TWV-2026-062 (Phase 2, task 34).
- Passwordless recovery via social / guardian flows — TWV-2026-043
  (Phase 3, task 55).

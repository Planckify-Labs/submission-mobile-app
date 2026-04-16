# TEE-enforced biometric gate — TWV-2026-025

**Owner:** mobile-app · **Spec ref:** TWV-2026-025.

> **Status:** Pairs with TWV-2026-060 (already shipped — Task 11).
> The signing-store helper already passes `requireAuthentication: true`,
> which routes the unwrap through Android Keystore /
> iOS Secure Enclave at the OS level. This note pins the additional
> rules so a future native-signing migration (TWV-2026-057) doesn't
> regress.

## What's in place today (TWV-2026-060)

- Wallet credential reads go through `signingSecureGet` in
  `services/security/walletSecureStore.ts`.
- `SIGNING_SECURE_STORE_OPTIONS` carries
  `requireAuthentication: true` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- iOS surfaces Face ID / Touch ID; Android surfaces BiometricPrompt.
- Wrapper enforces this for: seed, private key, PIN hash, signing
  records — see `services/walletService.ts` and
  `services/security/appLock.ts`.

## What this task adds

A TEE / Secure Enclave-resident signing key is the next step. The
soft path (signing material in JS heap) is what
`docs/wallet-security-task/62_native_signing_design_note.md` covers —
this note is the security-side view.

Hard rules for the future native-signing migration:

1. The wallet's signing key MUST be Keystore- / Secure-Enclave-
   resident; the JS heap NEVER holds the raw key.
2. The signing operation invokes the OS biometric prompt every time
   (no time-window grace period).
3. Biometric-set change invalidates the key (Android
   `setInvalidatedByBiometricEnrollment(true)` /
   iOS `kSecAccessControlBiometryCurrentSet` — already required by
   TWV-2026-061 / Task 12).
4. The recovery path is the app password (PIN) hashed via PBKDF2
   already shipped in `appLock.ts`.

## Pre-implementation checklist

When the native-signing migration starts:

- [ ] Native module: `react-native-keychain` (StrongBox / Secure
      Enclave mode) or a thin custom bridge to
      `Keystore.generateKey()` / `SecKeyCreateRandomKey()`.
- [ ] JS-side `services/security/nativeSigner.ts` exports
      `sign(payload): Promise<Hex>` and never returns the key.
- [ ] `services/walletService.ts` `getAccountForWallet` returns a
      Viem account whose `signTransaction` / `signMessage` /
      `signTypedData` route through `nativeSigner.sign` — the
      existing JS-heap path is the migration source, not the target.

## Review gate

Any PR that touches the signing path MUST cite TWV-2026-025 and
confirm `requireAuthentication: true` is still set on the SecureStore
call site.

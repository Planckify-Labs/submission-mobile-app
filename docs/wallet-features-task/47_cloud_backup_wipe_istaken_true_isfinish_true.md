# Task 47 — Cloud backup (encrypted, opt-in) + wipe wallet

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.11d

## Why this matters

Users need a way to recover their wallet if they lose their device. Cloud
backup provides this (opt-in, encrypted). Conversely, users need a destructive
"wipe everything" option for when they sell their device or suspect compromise.

## Scope

Create:

- `app/settings/security/cloud-backup.tsx` — cloud backup screen:
  - Opt-in flow: user chooses a backup password (NOT the PIN).
  - Encrypt seed phrase client-side with AES-256-GCM, key derived via PBKDF2
    from backup password (100k+ iterations).
  - Store encrypted blob in:
    - iOS: iCloud Keychain via `expo-secure-store` with `keychainAccessible`
      set to sync across devices.
    - Android: Google Cloud Key Vault or Android Keystore backup (via
      `expo-secure-store` backup-eligible keys).
  - Backup password is NOT stored anywhere — user must remember it.
  - Show backup status: last backup date, backup exists (yes/no).
  - "Delete backup" option.
- Recovery flow (during onboarding):
  - "Restore from backup" option on the welcome screen.
  - User enters backup password → decrypt → restore wallets.
  - If wrong password → clear error message, no data loss.
- `app/settings/security/wipe.tsx` — wipe wallet:
  - Requires full auth (biometric + PIN).
  - Shows 10s countdown before executing ("Wiping in 10… 9… 8…").
  - Cancel button visible throughout countdown.
  - Execution: deletes all keys from `SecureStore`, clears `expo-sqlite`,
    resets app to onboarding screen.
  - **Destructive — no undo.**
  - If cloud backup exists, warn: "You have a cloud backup. After wiping, you
    can restore using your backup password."

## Rules (non-negotiable)

- **Encryption is client-side only** — plaintext seed never leaves the device.
- **Backup password ≠ PIN** — enforce minimum 8 characters, at least 1 number.
- **PBKDF2 iterations must be ≥ 100,000** — benchmark on low-end devices to
  ensure < 3s derivation time.
- **Wipe is truly destructive** — no hidden recovery. If no backup exists,
  the seed is gone.
- **10s countdown is mandatory** — no way to skip.

## Acceptance

- [ ] Cloud backup encrypts and stores seed in platform keychain.
- [ ] Recovery decrypts with correct password and restores wallets.
- [ ] Wrong password shows error, doesn't corrupt data.
- [ ] Backup password validation enforces minimum requirements.
- [ ] Wipe requires full auth + 10s countdown.
- [ ] Wipe clears all keys, SQLite data, and resets to onboarding.
- [ ] Wipe warns about cloud backup existence.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Multi-device sync (requires account server).
- Social recovery.

## Depends on

- Task 43 (app lock — for auth), Task 46 (screenshot guard infrastructure).

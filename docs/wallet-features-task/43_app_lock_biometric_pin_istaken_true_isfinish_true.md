# Task 43 — Biometric / PIN lock: setup, triggers, per-action re-auth

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.11a

## Why this matters

The app is currently unprotected if the device is unlocked. A production wallet
must require biometric or PIN authentication to access funds and sign transactions.

## Scope

Create:

- `services/security/appLock.ts` — state machine for app lock:
  - States: `unset`, `locked`, `unlocked`.
  - Lock methods: `biometric`, `pin`, `biometric+pin`.
  - Lock triggers: app foreground after >30s background, on-demand lock button.
  - Per-action auth: signing, sending, exporting keys, revoking approvals always
    re-prompt biometric/PIN regardless of lock state.
  - Configurable: user can disable per-action auth for small amounts (threshold
    they set, stored in `expo-sqlite`).
  - PIN stored as argon2 hash in `expo-secure-store`.
- `components/security/BiometricPrompt.tsx` — wrapper around `expo-local-authentication`
  that handles Face ID / fingerprint with fallback to PIN.
- `components/security/PinPad.tsx` — 6-digit PIN entry screen:
  - Setup: enter PIN → confirm PIN → store argon2 hash.
  - Unlock: enter PIN → verify against stored hash.
  - No "show PIN" option. Backspace only.
- `app/settings/security/index.tsx` — security settings screen:
  - Enable/disable biometric lock.
  - Change PIN.
  - Per-action auth toggle + amount threshold.
  - Lock timeout setting (30s, 1min, 5min, immediately).
- Setup flow: after wallet creation, prompt to enable biometric or PIN.
  Strongly recommended, not forced (user can skip but sees a warning banner
  on portfolio until enabled).
- `AppState` listener in `app/_layout.tsx`: on foreground after timeout, show
  lock screen overlay.

## Rules (non-negotiable)

- **PIN is never stored in plaintext.** Argon2 hash only, in `expo-secure-store`.
- **Biometric uses `expo-local-authentication`** — no direct native module.
- **Per-action auth cannot be completely disabled** for high-value operations
  (seed export, wipe). Only the amount threshold applies to sends.
- **Lock screen is a full overlay** — no content visible behind it.

## Acceptance

- [ ] Setup flow prompts for biometric/PIN after wallet creation.
- [ ] App locks after configured timeout when backgrounded.
- [ ] Biometric unlock works (Face ID / fingerprint).
- [ ] PIN unlock works with argon2 verification.
- [ ] Per-action auth prompts before signing, sending, exporting.
- [ ] Amount threshold skips per-action auth for small sends.
- [ ] Security settings screen allows changing all options.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Screenshot prevention (task 46).
- Seed/key export screens (task 46).
- Cloud backup encryption (task 47).

## Depends on

- None (can start independently).

## Unblocks

- Task 46 (seed/key export needs auth), Task 47 (wipe needs auth).

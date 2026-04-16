# Task 39 — TEE-enforced biometric gate on SecureStore reads

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-025, §7, §9

## Why this matters

On a rooted/jailbroken device, Frida bypasses any JS-layer
"if (biometricsOk) sign()" check in milliseconds. The only durable
defence is to bind biometric auth at the TEE / Secure Enclave layer:
the key is *configured* so the TEE refuses to release it until
biometrics succeed, so a compromised JS heap can't forge approval.
This task is the design-review pass that locks in the UX/security
trade-off before the signing-key refactor ships in Tasks 11 and 12
(TWV-2026-060/061).

## Scope

Design / policy task that backstops the implementation tasks:

- Write `docs/design-notes/tee-biometric-gate.md` specifying:
  - iOS: keys stored with `kSecAccessControlBiometryCurrentSet`;
    `requireAuthentication: true` on every signing SecureStore read
    (pairs with Task 11, TWV-2026-060).
  - Android: keys stored with `setUserAuthenticationRequired(true)`
    and `setIsStrongBoxBacked(true)` where the device supports it,
    falling back to TEE-backed Keystore otherwise.
  - UX trade-off: every signing action prompts biometrics; the note
    specifies the acceptable prompt-frequency budget (per-tx, not
    per-session) and calls out the app-password fallback path
    (Task 12, TWV-2026-061).
  - Root/jailbreak detection is a surfaced warning (`expo-device` /
    `jail-monkey`), never a gate — the note documents that we do not
    trust client-side root detection as a security boundary.
  - Private-key lifetime in the JS heap: zero-copy where possible,
    otherwise "just-in-time, immediately dereferenced"; the note
    records the acceptable lifetime (milliseconds of the signing
    call, not seconds).
- Audit `services/walletService.ts` against this spec and list the
  deltas as follow-up tickets (the code-level fix is in Tasks 11/12;
  this task just enumerates what the design demands).
- Flag TWV-2026-025 as a review gate on any PR that touches
  `services/walletService.ts` or SecureStore read paths.

## Rules (non-negotiable)

- Biometric auth is enforced by the TEE, not by a JS boolean.
- Private-key material is never retained in JS state, Zustand store,
  or React context — it is fetched, used, dereferenced.
- Root detection is UX-only; its output never unlocks or blocks key
  access.
- The design note is the source of truth; if code diverges, the note
  is updated first, then the code.

## Acceptance

- [ ] `docs/design-notes/tee-biometric-gate.md` landed with the iOS
      and Android attribute matrix.
- [ ] Audit of `services/walletService.ts` completed; deltas filed
      as follow-up tasks referencing Tasks 11/12.
- [ ] PR template gains a "touches wallet key reads? cite
      TWV-2026-025 + 060 + 061" prompt.
- [ ] UX budget for biometric prompts documented and signed off by
      design.
- [ ] pnpm check:syntax passes.

## Out of scope

- The implementation of `requireAuthentication` on each call (that
  is Task 11, TWV-2026-060).
- The app-password recovery flow (Task 12, TWV-2026-061).
- Frida port scanning / anti-debug heuristics (treated as signals
  only; see spec §6 TWV-2026-025 bullet).

# Task 43 — WalletConnect v2 via SecureStore (when integrated)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-030, §7, §9

## Why this matters

Historical WalletConnect v1 stored session keys in browser
`localStorage`; any XSS could steal them and issue signature
requests through the paired wallet (CVE-2022-28843). The fix is
two-part: use v2 (`@walletconnect/sign-client`) and, on the wallet
side, persist session state in `expo-secure-store`, never in
`AsyncStorage`. We do not ship WalletConnect today — this task
captures the design rules now so that whenever the feature lands, it
lands safely instead of copying a tutorial.

## Scope

Pre-implementation design task:

- Write `docs/design-notes/walletconnect-v2.md` specifying:
  - v2 only: `@walletconnect/sign-client`; explicit rejection of v1
    pairing URIs in the UI.
  - Session persistence: `expo-secure-store` with the same
    `WHEN_UNLOCKED_THIS_DEVICE_ONLY` attributes used for seed
    storage (pairs with Task 03, TWV-2026-004). No `AsyncStorage`
    fallback — if SecureStore is unavailable, sessions are
    in-memory only.
  - Expiry cap: sessions expire within 24h by default; reconnection
    requires an explicit user tap (no silent re-approval).
  - UI requirements: a Settings screen showing active sessions —
    dApp name, icon, URL, per-chain scope, per-method scope — with
    one-tap revoke.
  - Signing: every WC signature request passes through the same
    signer UI as injected-provider requests; no bypass path.
- Add a pre-implementation checklist the integrator must satisfy
  before the feature can ship: v2-only library import, SecureStore
  wiring, expiry cap, sessions screen, parity test with injected
  bridge.
- Flag TWV-2026-030 as a review gate on the WalletConnect feature
  PR. Reference Task 12 (TWV-2026-061) so WC pairing also respects
  current-biometric-set binding.

## Rules (non-negotiable)

- When the feature ships, it is v2 only — no v1 compatibility shim.
- Session material goes to SecureStore or nowhere; AsyncStorage is
  forbidden for this data.
- Every WC-originated signature renders in the existing signer UI;
  no "simplified" WC-specific prompt.

## Acceptance

- [ ] `docs/design-notes/walletconnect-v2.md` landed with the rules
      and pre-implementation checklist.
- [ ] TWV-2026-030 added to the "feature review gates" index so the
      WalletConnect PR reviewer checks this note.
- [ ] Cross-reference recorded from this note to Task 12 (biometric
      binding) and Task 19 (TWV-2026-015 origin pinning, which
      applies to WC session origins as well).
- [ ] Note links to the current SecureStore attribute choice
      (Task 03) so WC reuses that posture.
- [ ] pnpm check:syntax passes.

## Out of scope

- Actually integrating WalletConnect (no feature work in this task).
- Mobile linking / deep-link plumbing for WC pairing URIs (tracked
  with Task 21, TWV-2026-024 Universal/App Links).
- WC v1 support (explicitly forbidden).

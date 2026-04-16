# Task 26 — "Signing mode" profile (dApp browser / deeplinks / push disabled)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-035, §7, §9

## Why this matters

Radiant Capital lost $50M when malware on signer laptops rendered a
benign tx while signing a malicious payload. The defence is to shrink
the signing device's attack surface: no browsing, no deeplinks, no
push. For high-value mobile users we should ship a "signing mode"
profile that disables the dApp browser, deeplink routing, and push
notifications so the device cannot receive the malware-delivery
vectors that compromised Radiant signers.

## Scope

- Add a user-facing toggle in Settings (new or existing security
  settings screen — see spec §9) called "Signing mode". When ON:
  - DApp browser entry points (home tile, URL bar, history) are
    hidden.
  - Deeplink handlers for dApp-origin schemes are short-circuited to
    a "Signing mode is ON" screen.
  - Push registration is disabled; any cached handler refuses to
    route to action screens.
  - The AI agent's outbound link opener (see task 24) is disabled.
- Persist the toggle in `SecureStore` with `requireAuthentication:
  true` so flipping it OFF requires biometrics.
- Expose a `useSigningMode()` hook that wrappers across the app read
  synchronously on mount.
- On app launch, if Signing mode is ON, mount a lightweight shell
  (wallet + signer UI only); skip dApp browser modules.

## Rules (non-negotiable)

- Disabling Signing mode is a destructive action — require biometric
  auth and a short-delay confirmation.
- Signing mode ON must NOT alter signer-UI behaviour for normal
  in-wallet tx flows; it only removes attack surfaces.
- Feature flag default: OFF. Opt-in only.

## Acceptance

- [ ] Settings toggle persists across relaunch.
- [ ] With Signing mode ON, the dApp browser tab/entry and URL bar
      are hidden or disabled.
- [ ] Deeplinks that would normally open a dApp route land on the
      "Signing mode is ON" screen.
- [ ] Push registration is skipped when Signing mode is ON.
- [ ] Flipping the toggle OFF requires biometrics and a confirmation.
- [ ] Regression: with Signing mode OFF, all existing flows behave
      identically.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Air-gapped signing / QR-based signing ceremonies.
- A separate "signing-only" build variant of the app.
- MDM-pushed enforcement of Signing mode (enterprise feature).

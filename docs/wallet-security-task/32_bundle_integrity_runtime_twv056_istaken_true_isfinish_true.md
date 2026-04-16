# Task 32 — Launch-time bundle SHA-256 vs signed manifest check

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-056, §7, §9

## Why this matters

Hermes bytecode is reversible; any secret in the JS bundle is
discoverable with `hermes-dec` / `hbctool`. Worse, a tampered bundle
(planted via OTA compromise, jailbreak tool, or MDM injection) runs
with all the app's permissions — including `expo-secure-store`
access. A launch-time check that the loaded bundle's SHA-256 matches
what the signed manifest advertises closes the "tampered bundle,
valid binary" gap and complements task 09 (EAS code signing).

## Scope

- Add a launch-time integrity shim — `pollyfills.ts` or the earliest
  JS entry point (see spec §9) — that:
  - Reads the currently-loaded bundle file from the Expo updates
    directory.
  - Computes its SHA-256.
  - Reads the advertised hash from the signed manifest (the one
    validated by EAS code signing in task 09).
  - On mismatch, refuses to proceed: shows a static "Bundle integrity
    check failed" screen with a "Reinstall from the store" CTA and
    exits the JS runtime gracefully.
- Audit the bundle for hard-coded secrets. Grep for `EXPO_PUBLIC_*`
  uses that should not be public (API keys, admin endpoints);
  document the allowlist of values that are OK to ship in the
  bundle.
- Add a static check in CI that grep-finds any candidate secret
  patterns in the built bundle (`EXPO_PUBLIC_SECRET*`, `sk_...`,
  private-key-shaped hex strings) and fails the build.

## Rules (non-negotiable)

- The integrity shim must run BEFORE any network call, any SecureStore
  access, and any module that imports signing code.
- A mismatch terminates the app — no "degraded mode", no partial
  functionality.
- The shim itself must be minimal — no heavy imports — so a tampered
  bundle cannot easily patch around it.

## Acceptance

- [ ] A synthetic bundle tamper (flip a byte in the bundle after
      install) results in the integrity-fail screen on next launch.
- [ ] A clean install launches normally; the integrity shim adds <50ms
      to cold start (measured on a mid-tier Android device).
- [ ] CI job rejects a build that introduces a candidate-secret
      pattern in the bundle.
- [ ] Grep shows no hard-coded API keys or admin endpoints in the
      current bundle.
- [ ] Regression: normal app launch unaffected.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Obfuscation of critical modules (`javascript-obfuscator` or similar
  — documented as speed-bump, not shipped here).
- Moving signing logic to a native module (covered by task 62 in
  Phase 3).
- iOS vs Android parity of the integrity-fail screen's visual polish.

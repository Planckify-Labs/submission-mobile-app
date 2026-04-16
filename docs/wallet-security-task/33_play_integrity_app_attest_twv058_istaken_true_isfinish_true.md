# Task 33 — Play Integrity / App Attest on sign-above-threshold

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-058, §7, §9

## Why this matters

On rooted / jailbroken devices, Frida can hook the RN bridge (`RCTBridge`
on iOS, `CatalystInstance` on Android) and observe every JS↔Native
message — including tx payloads and signing requests. The New
Architecture (Fabric / TurboModules) shifts the hook surface to JSI
but remains similarly feasible. App-layer anti-instrumentation is a
speed-bump. The durable defence is OS-level device attestation:
require a passing Play Integrity (Android) / App Attest (iOS) signal
before any sign-above-threshold operation.

## Scope

- Add a native module wrapper (via `expo-app-integrity` or a small
  custom module — see spec §9) exposing:
  - Android: Play Integrity token fetch + server-side verification
    wrapper.
  - iOS: App Attest key generation, assertion, and server-side
    verification wrapper.
- Add a signer-UI gate: any tx whose native-equivalent value exceeds
  a configurable threshold (e.g. $500 default) requires a fresh
  device-attestation token within the last N minutes.
- On attestation failure (rooted device, Play Integrity returns
  `BASIC`/`UNVERIFIED`, App Attest fails assertion): show a
  full-screen "Your device cannot be attested — sign at your own
  risk" block; allow small-value signs with a hard-warn, block
  above-threshold signs.
- Log attestation outcomes (outcome only, no PII) to the backend for
  device-ecosystem monitoring.
- Expose a diagnostic in Settings: "Device integrity" with the last
  outcome + timestamp.

## Rules (non-negotiable)

- Attestation is a prerequisite, not a signal — above-threshold sign
  is blocked (not merely warned) on attestation failure.
- Attestation tokens are short-lived — refetch on every
  above-threshold sign; do not cache beyond the configured window.
- The gate never runs on read-only / small-value flows — cold-start
  must not be blocked on Play Integrity.

## Acceptance

- [ ] `expo-app-integrity` (or equivalent) integrated; native build
      passes on both platforms.
- [ ] Above-threshold sign attempts fetch a fresh attestation token
      and verify server-side before the signer-UI enables Sign.
- [ ] Simulated attestation failure blocks above-threshold sign;
      small-value sign still works with a warning.
- [ ] Settings diagnostic displays the last attestation outcome.
- [ ] Regression: read-only flows and below-threshold flows are not
      blocked on attestation.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Server-side infrastructure for Play Integrity / App Attest
  verification (owned by the API team; this task covers the mobile
  integration).
- Bridge-payload encryption between JS and native module (tracked
  separately in Phase 3).
- Attestation on non-Google Android distributions (Huawei HMS, etc.).

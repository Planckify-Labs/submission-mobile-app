# Task 34 — Android Key Attestation chain validation at launch

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-062, §7, §9

## Why this matters

Android Keystore's TEE / StrongBox is only as trustworthy as the boot
chain. On rooted devices or `/system`-modified ROMs, Play Integrity
drops to `BASIC`/`UNVERIFIED` and in some cases the Keystore
attestation certificate chain itself is invalid — malicious ROMs have
shipped attacker-controlled attestation keys. Validating the full
attestation chain at launch, rooted in Google's pinned hardware-
attestation root CA, catches this class directly and complements the
Play Integrity signal from task 33.

## Scope

- Add a native-module wrapper (see spec §9) exposing:
  - `getKeyAttestationChain(keyAlias)` — calls
    `KeyStore.getCertificateChain(keyAlias)` for the wallet-signing
    key.
  - `validateAttestationChain(chain)` — verifies the chain roots in
    Google's hardware-attestation root CA, pinned in the app binary.
- At app launch, run attestation on the wallet-signing key (or on a
  sentinel key created at first-run if no signing key exists yet).
  Cache the result for the session.
- Ensure every signing key created by the app is generated with:
  - `setIsStrongBoxBacked(true)` (falls back to TEE if unavailable).
  - `setUserAuthenticationRequired(true)`.
  - `setInvalidatedByBiometricEnrollment(true)`.
  - `setUnlockedDeviceRequired(true)`.
- On attestation failure at launch: degrade the app to read-only for
  above-threshold ops (coordinate with task 33's threshold); allow
  small amounts; hard-warn the user in a banner at the top of the
  home screen.
- Log attestation-chain failure events (outcome only, no PII) so the
  team can monitor device-ecosystem risk.
- This task is Android-only. iOS Secure Enclave attestation lives
  under task 33 (App Attest).

## Rules (non-negotiable)

- Root CA is pinned in the binary; chain validation does not trust
  the system trust store.
- Attestation failure never silently degrades — the banner + above-
  threshold block are both required.
- Key generation parameters above are mandatory — no path creates a
  software-only key for signing.

## Acceptance

- [ ] Native module returns the attestation chain for the wallet-
      signing key.
- [ ] Chain validation pins Google's hardware-attestation root CA;
      unit test covers a known-good chain and a known-bad chain.
- [ ] Launch-time attestation runs once per session and caches the
      outcome.
- [ ] Above-threshold signing is blocked on attestation failure;
      small-value signs work with a warning banner.
- [ ] All signing keys are created with StrongBox preference and the
      auth / enrollment / unlock flags above.
- [ ] Regression: unmodified devices launch and sign normally.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- iOS Secure Enclave attestation (handled by task 33).
- Remote attestation-outcome dashboards on the backend.
- Recovering from a key invalidated by biometric re-enrollment —
  covered by task 12 in Phase 1.

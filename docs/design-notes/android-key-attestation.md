# Android Key Attestation chain validation — TWV-2026-062

**Owner:** mobile-app + backend · **Spec ref:** TWV-2026-062.

> **Status:** Native cert-chain work + backend verifier.

## Hard rule

At first launch on Android, the wallet generates an attestation key
inside Android Keystore with `setAttestationChallenge(...)`, then
requests the X.509 attestation chain via `KeyStore.getCertificateChain`.
The chain MUST be:

1. Validated against the Google attestation root CA (pinned).
2. Parsed for the `Attestation Extension` (OID 1.3.6.1.4.1.11129.2.1.17).
3. Asserted to have:
   - `attestationVersion` ≥ the minimum required (currently 4),
   - `attestationSecurityLevel` == `TrustedEnvironment` or
     `StrongBox`,
   - `verifiedBootState` == `VERIFIED`,
   - `attestedKeyOrigin` == `KM_ORIGIN_GENERATED`.

Failure on any of the above means the device is rooted, the
bootloader is unlocked, or the keystore is software-emulated. The
wallet refuses to sign any signature-producing request and surfaces
a "device integrity check failed" screen.

## JS hooks

The chain validation runs native-side; the JS surface is:

- `services/security/keyAttestation.ts` exposes `getDeviceTrust():
  Promise<"trusted" | "untrusted" | "unknown">`. `unknown` covers
  iOS (where this control is App Attest's job — see TWV-2026-058)
  and old Android < 8.
- `services/bridge/DappBridge.ts` queries this on every signature
  request; `untrusted` blocks production-channel signing entirely.
- A user-visible Settings row "Device trust: trusted/untrusted"
  records the most recent verdict so support can triage.

## Pre-implementation checklist

- [ ] Native module: `expo-key-attestation` (community) or a thin
      bridge that wraps `KeyStore.getCertificateChain`.
- [ ] Backend `/v1/attest/key-chain` endpoint validates the chain
      against pinned Google roots; returns canonical `trusted` /
      `untrusted` verdict.
- [ ] `services/security/keyAttestation.ts` shipped + wired into the
      bridge dispatch.
- [ ] Pin the Google root CA in `services/security/keyAttestationRoot.ts`.

## Review gate

Any PR that adds a signing path MUST cite TWV-2026-062 (in addition
to TWV-2026-058) and confirm the chain check runs.

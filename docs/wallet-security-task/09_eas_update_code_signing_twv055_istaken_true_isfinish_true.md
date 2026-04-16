# Task 09 — EAS Update code signing (KMS-backed key)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-055, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

EAS Update ships JS bundles OTA to installed apps. A compromised
update server — or a compromised CI env var holding the signing key —
hands an attacker full execution inside every user's wallet process,
including `expo-secure-store` access. The default Expo project trusts
HTTPS as the only integrity layer; that's not a layer for a wallet.
The spec names `app.config.ts` as the config surface and says the
signing key must live in cloud KMS or an HSM, not a CI env var. §9
"Supply chain" requires code-signing plus two-person approval on the
key.

## Scope

1. In `app.config.ts`, enable `expo.updates.codeSigningCertificate` +
   `codeSigningMetadata`. Ship the public certificate in the binary;
   wire the private key to AWS KMS (or equivalent) in the CI signing
   step — the CI role has sign-only access, never read.
2. Enforce `runtimeVersion` monotonicity and a server-side check that
   the publish timestamp in the signed manifest is strictly greater
   than the currently-installed bundle's timestamp. Client rejects
   rollbacks (a malicious actor who cannot sign new manifests must
   not be able to replay old signed ones).
3. Restrict channels: production channel is push-protected (only the
   release owner can publish); pre-release / beta channels require
   an in-app Settings opt-in, never a deeplink. No deeplink should
   switch update channel.
4. Document the key ceremony in a dedicated runbook (CI-adjacent,
   not in this folder): two-person approval on KMS `Sign` call,
   monthly rotation schedule, break-glass procedure. Reference the
   runbook from `app.config.ts` comments so engineers find it.

## Rules (non-negotiable)

- **Private signing key lives in KMS/HSM only.** No CI env var, no
  `.env.production`, no developer laptop copy.
- **Two-person approval on key use.** KMS IAM policy requires a
  second approver on every `Sign` call.
- **No rollback.** Client refuses any manifest whose publish-time is
  older than the installed one; monotonic `runtimeVersion`.
- **Channel switch is user-initiated in Settings.** Never a deeplink,
  never a remote-config toggle; §7.1.3 migration discipline.

## Acceptance

- [ ] `app.config.ts` exports `updates.codeSigningCertificate` +
      `codeSigningMetadata` referencing the production certificate.
- [ ] CI signing step invokes KMS with an IAM role that has no
      read/export permission on the key.
- [ ] Client-side rejection of an older-than-installed manifest is
      covered by a unit or integration test (fixture manifests with
      out-of-order timestamps).
- [ ] Settings screen exposes channel switch (production /
      pre-release / beta); deeplink fuzz test confirms no URL can
      change the channel.
- [ ] Runbook for key ceremony exists and is linked from
      `app.config.ts` comments.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Launch-time bundle SHA-256 vs signed manifest check —
  TWV-2026-056 (Phase 2, task 32).
- Play Integrity / App Attest on sign-above-threshold —
  TWV-2026-058 (Phase 2, task 33).
- Reproducible builds / SBOM — TWV-2026-006 (Phase 3, task 35).
- Bundle-integrity runtime checks beyond the signed manifest.

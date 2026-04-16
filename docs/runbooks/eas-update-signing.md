# EAS Update signing — key ceremony runbook

**Spec:** TWV-2026-055. **Non-regression:** §7.1.3 (migration
discipline).

This runbook describes how the production EAS Update signing key is
generated, stored, used, and rotated. Any deviation is a security
incident — file it in the incident tracker and page the release owner.

## Invariants

- Private signing key lives in **AWS KMS** (or an equivalent HSM-backed
  KMS). It never enters a developer laptop, a CI env var, an
  `.env.production`, or a repo commit.
- The CI signing role has **`kms:Sign` only** — no `kms:GetPublicKey`,
  no `kms:Decrypt`, no `kms:Export*`.
- Every `kms:Sign` call for the production channel requires a **second
  human approver**, enforced via the KMS key policy + AWS IAM
  `aws:MultiFactorAuthPresent` condition.
- The public certificate is shipped in the binary at
  `./certs/eas-update-prod.pem` and referenced from `app.config.ts`.
- Monthly **rotation** — a new certificate is issued; the previous cert
  is kept for one release cycle so in-flight updates can still verify.

## Ceremony: key generation

Run once per rotation. Witnessed by the release owner + one security
reviewer.

1. In AWS KMS, create an asymmetric signing key:
   - Key spec: `RSA_2048` (`rsa-v1_5-sha256` matches Expo's alg).
   - Key usage: `SIGN_VERIFY`.
   - Origin: `AWS_KMS`.
   - Description: `eas-update-prod-<YYYYMM>`.
2. Set the key policy to require two principals (release owner + one
   security reviewer) for `kms:Sign` and `kms:Decrypt`. Use
   `aws:MultiFactorAuthPresent: true` and
   `aws:PrincipalOrgPathsEquals` to pin to the release org path.
3. Export the public key (`kms:GetPublicKey`) and wrap it in an X.509
   certificate signed by the release owner's offline CA. Save as
   `./certs/eas-update-prod.pem` and commit to the repo.
4. Update `CODE_SIGNING_METADATA.keyid` in `app.config.ts` to the new
   key id (`eas-update-prod-<YYYYMM>`).
5. Tag the commit with `eas-update-rotation-<YYYYMM>` and attach the
   AWS CloudTrail event id for the key-creation call.

## Ceremony: publishing an update

1. Release owner opens a PR that bumps `version` and (if applicable)
   `runtimeVersion`.
2. CI workflow `publish-eas-update-prod` runs `eas update` with the
   KMS signing adapter — the `kms:Sign` call blocks until a second
   approver clicks "Approve" in the AWS approvals console.
3. The published manifest is verified client-side by the shipped cert.
   The client ALSO refuses any manifest whose `createdAt` is older or
   equal to the installed one (see
   `services/security/updateVerifier.ts`, `decideAndPersistManifest`).
4. If the client rejects a manifest, it falls back to the previous
   good bundle. A rejected manifest is surfaced in the activity sink
   as a telemetry event (no user-visible prompt — it looks identical
   to "no update available").

## Break-glass: compromised key

1. Release owner revokes the KMS key (`kms:ScheduleKeyDeletion` with
   a 7-day waiting period, plus `kms:DisableKey` immediately).
2. Generate a fresh key pair via the generation ceremony above.
3. Ship a new binary build (App Store / Play Store) referencing the
   new certificate. EAS Update cannot rotate the cert OTA — that would
   require the old (now compromised) key to sign the rotation manifest.
4. File an incident post-mortem naming the compromised scope and the
   detection path.

## Break-glass: rollback needed

Rolling back is **not** supported via EAS Update — the client refuses
older timestamps. To roll back, publish a *newer* manifest that bundles
the older JS. This is intentional: an attacker who captured a valid
old signed manifest must not be able to replay it.

## Ownership

- **Release owner:** team lead, currently Satria.
- **Security reviewer:** rotated monthly per the security on-call
  roster.
- **Runbook review:** annually, or after any break-glass event.

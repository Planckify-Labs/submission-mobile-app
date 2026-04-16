# Multisig / guardian independence spec

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-039 (task 51). Companion: TWV-2026-043 (task 55, social
recovery), TWV-2026-042 (task 54, multi-bundler), TWV-2026-041
(task 53, paymaster policy).

**Status:** Design-property spec. No multisig ships today. This
document is the pre-implementation contract for any M-of-N signer set
in Takumi's future — social-recovery guardians, multi-bundler
submission, multi-paymaster sponsorship, multi-operator infra.

Threshold schemes are security theater when signer environments
correlate. Orbit Chain (Jan 2024, ~$82M) lost precisely because 7 of
10 "independent" validator keys shared KMS tooling, admin, or
deployment surface. The design-time invariants below make that class
of loss detectable at enrollment, not in the post-mortem.

## Pre-implementation checklist (merges block on any unchecked box)

Applies to any PR that introduces an M-of-N signer set — social-
recovery guardians, multi-bundler submission, multi-paymaster
sponsorship, custody multisig, etc.

- [ ] Hardware independence (§1) — signers not sharing vendor / model
      correlation.
- [ ] Network independence (§2) — signers not sharing ISP / VPN /
      cloud-region correlation.
- [ ] Admin independence (§3) — no single human/account can access
      ≥ M signing environments.
- [ ] Backup independence (§4) — seed backups not collapsed to a
      single cloud provider.
- [ ] Social independence (§5) — guardians not all reachable through
      the same chat platform / family group.
- [ ] Threshold M chosen against the correlated-compromise risk model
      (§6).
- [ ] Independence asserted in documentation at enrollment, re-asserted
      annually or at any material infra change (§7).

"Use an HSM" is NOT a substitute for independence. A single HSM shared
by all signers reintroduces correlation.

## 1. Hardware independence

Signers should not share the same vendor / model in ways that
correlate firmware-supply-chain risk.

Examples of correlated hardware:

- All three guardians on Ledger Nano X running the same firmware
  version. A Ledger-specific CVE drops all three simultaneously.
- Two servers sharing the same KMS provider on the same region with
  the same root account. KMS incident = both compromised.

Examples of uncorrelated hardware:

- Guardian A on Ledger, guardian B on Trezor, guardian C on
  a Yubikey-backed EOA.
- Servers split across AWS KMS (us-east-1) + Google KMS (europe-west4)
  + on-prem HSM.

Enrollment UI:

- Vendor / model fingerprint is captured at enrollment time (HW
  attestation provides this — cross-link task 58 / TWV-2026-046).
- If ≥ 2 signers share fingerprint, the UI surfaces the correlation
  and requires explicit acknowledgement.

## 2. Network independence

Signers should not share:

- Same home ISP.
- Same corporate VPN.
- Same cloud region for their key-holding infra.

Uncorrelated examples:

- Guardian A on home Comcast, guardian B at work on Verizon Business,
  guardian C on a phone LTE line. Three different failure domains.
- Servers spread across cloud regions on different providers.

Enrollment UI:

- Network-posture fingerprints collected during enrollment (user
  consents). Overlap warnings shown explicitly.
- For server-side signers, the provisioning ceremony (see
  `docs/hot-wallet-custody-policy.md` §4) documents the network
  segment each signer lives on.

## 3. Admin independence

No single human — or single cloud-account / IAM role — can access
≥ M signing environments.

Rules:

- Separation of duties: the engineer who provisioned signer A does
  not have admin credentials to signer B.
- KMS IAM: a `sign` role is distinct from the `admin` role. An admin
  who can change IAM is distinct from an admin who can read key
  material.
- Two-person review is required for any IAM change affecting ≥ M
  signers.

Enrollment UI (for user-facing multisig):

- Guardian emails are captured and checked for overlap (same account,
  same recovery email domain). The UI warns on overlap.

## 4. Backup independence

Seed backups should not collapse to a single cloud provider.

Examples of correlated backup:

- Seed backed up to iCloud + guardian's seed also in iCloud. A single
  iCloud breach drops both.
- Seed written down on paper in the same safe as the guardian's seed.
  One burglary drops both.

Uncorrelated examples:

- Seed in a steel-plate backup at home; guardian's seed in a bank
  safe-deposit box.
- Seed in iCloud; guardian's seed on a Trezor in another jurisdiction.

Enrollment UI:

- Backup method is captured at enrollment (user declares: "iCloud",
  "steel", "bank box", "HW only", etc.). Overlap surfaced.

## 5. Social independence

In social recovery, guardians should not all be reachable through the
same chat platform or the same family / work group. A phishing
campaign against the one group can compromise M guardians at once.

Rules:

- Guardian set enumerates the primary communication channel per
  guardian (SMS, Signal, Telegram, email, in-person). Collision
  between ≥ M guardians triggers an enrollment-UI warning.
- "Family WhatsApp group" is treated as a single channel regardless
  of how many guardians are in it.

## 6. Choosing M

Threshold M is chosen against the **correlated-compromise** risk
model, not the independent-compromise model.

Procedure:

1. Enumerate compromise modes across the signer set: vendor CVE,
   ISP DNS hijack, admin-account compromise, cloud-region outage,
   phishing campaign against a chat group, etc.
2. For each mode, count the signers it can take out simultaneously.
3. M must exceed the worst-case single-mode count. If two guardians
   share a compromise mode, they count as one.

Consequence: "3-of-5 guardians" with 2 on iCloud + 2 on Gmail
collapses to effectively "3-of-3". Recompute, then pick guardians to
restore the intended margin.

## 7. Ongoing assertion

- Independence is asserted in documentation at **enrollment** time —
  captured in the enrollment record with the overlap analysis.
- Re-asserted **annually** or at any material infra change (guardian
  changes jobs, moves to a new ISP, rotates their HW wallet, etc.).
- A re-assertion that fails the checklist triggers a guardian-rotation
  recommendation, surfaced in the account details screen.

## 8. Review gate

Any PR that introduces an M-of-N signer set MUST:

- Cite TWV-2026-039.
- Attach the enrollment record with the overlap analysis across
  §1–§5.
- Propose M against the correlated-compromise model (§6).
- Document the annual re-assertion cadence (§7).

Reviewers: blocks any PR whose signer set fails the checklist without
an explicit risk acceptance signed off by the security team.

## 9. Cross-links

- Task 54 / TWV-2026-042 — multi-bundler fallback (independence
  applied to bundler selection).
- Task 55 / TWV-2026-043 — social-recovery spec (consumes §1–§5).
- Task 53 / TWV-2026-041 — paymaster policy (independence for
  paymaster-signer + governance keys).
- Task 50 / TWV-2026-037 — hot-wallet custody policy (independence
  applied to the partition map).
- Task 58 / TWV-2026-046 — HW pairing attestation; vendor / model
  fingerprint surface that §1 consumes.

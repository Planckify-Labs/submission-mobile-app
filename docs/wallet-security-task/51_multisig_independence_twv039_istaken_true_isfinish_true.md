# Task 51 — Independence property for multisig / guardian sets

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-039, §7, §9

## Why this matters

Orbit Chain lost ~$82M in Jan 2024 when 7 of 10 "independent" validator
keys turned out to share KMS tooling, admin, or deployment surface —
threshold schemes are security theater when signer environments
correlate. TakumiAI does not ship multisig or social recovery today, but
both features are on the roadmap, and the independence property is a
design-time invariant that is nearly impossible to retrofit.

## Scope

Design-property task. Deliverables:

- Add a new section to the forthcoming `docs/social-recovery-spec.md`
  and `docs/multisig-spec.md` (placeholder docs created by this task if
  they do not yet exist) titled "Independence property." It must
  enumerate, for any M-of-N guardian or signer set:
  - Hardware independence: signers should not share the same vendor /
    model in ways that correlate firmware-supply-chain risk.
  - Network independence: signers should not share the same home ISP,
    corporate VPN, or cloud region for their key-holding infra.
  - Admin independence: no single human / account can access ≥ M
    signing environments.
  - Backup independence: seed backups should not share a single cloud
    provider (iCloud + iCloud is correlated; iCloud + a steel backup
    is not).
  - Social independence: in social recovery, guardians should not all
    be reachable through the same chat platform or the same family
    WhatsApp group.
- Add a pre-implementation checklist to any multisig / guardian task:
  the design review explicitly tests each of the above bullets against
  the chosen architecture.
- Flag TWV-2026-039 as a review gate — no PR that introduces multisig
  or social recovery can merge without a sign-off against the
  independence checklist.

## Rules (non-negotiable)

- Threshold (M) is chosen against the *correlated-compromise* risk
  model, not the independent-compromise one. If two guardians share a
  compromise mode, they count as one.
- Independence is asserted in documentation at enrollment time and
  re-asserted annually or at any material infrastructure change.
- "Use an HSM" is not a substitute for independence; a single HSM
  shared by all signers reintroduces correlation.

## Acceptance

- [ ] `docs/social-recovery-spec.md` and `docs/multisig-spec.md`
      placeholder documents exist with the independence section.
- [ ] Pre-implementation checklist added; linked from the Phase-3
      entries for TWV-2026-043, TWV-2026-044.
- [ ] Review gate recorded; backlog entries for multisig / guardian
      features cross-link here.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing multisig or social recovery (future tasks).
- Vendor selection for HSM / cloud KMS.
- Key-rotation ceremony runbooks (separate operational task).

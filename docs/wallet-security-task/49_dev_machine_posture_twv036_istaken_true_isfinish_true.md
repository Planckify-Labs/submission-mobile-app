# Task 49 — Dev-machine posture + OOB tx attestation

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-036, §7, §9

## Why this matters

DMM Bitcoin lost ~$305M in May 2024 when a Ginco developer's session
was compromised via LinkedIn-delivered malware ("pre-employment
test"); the attacker rode the authenticated session to replace a
legitimate withdrawal tx with a drain. Any operational signing
architecture where the developer workstation is part of the trust
boundary — without an out-of-band attestation — inherits DMM's
vulnerability. This task writes the posture rules so the team's own
laptops don't become the weak link.

## Scope

Operational/runbook task:

- Write `docs/runbooks/operational-signing-posture.md` covering:
  - Dev-machine hardening: MDM profile, Gatekeeper on, XProtect
    current, no unsigned-binary execution, no third-party IDE
    plugins without review, no unreviewed package managers.
  - Package-manager allowlist: the approved registries (npm, GitHub,
    specific private mirrors) and the review process for adding
    anything else.
  - Session-lifetime rule: any workstation session that can approve
    or submit a production tx expires in minutes, not hours; re-auth
    with biometrics per tx class.
  - Out-of-band (OOB) attestation: any tx above a documented
    threshold requires a secondary channel confirmation — phone
    call, secondary device, or HSM-displayed hash — independent of
    the originating workstation.
  - Trust-role separation: no single device holds both "enters
    password / clipboard / general browsing" and "live signing key"
    simultaneously.
  - Social-engineering drill: yearly table-top exercise where the
    team practices the DMM / Radiant scenario (recruiter PDF,
    malicious take-home test, compromised Telegram dropper).
- For the end-user side, add a short note referencing the wallet's
  education screen on BIP-39 multi-chain blast radius (pairs with
  Task 50, TWV-2026-037).
- Flag TWV-2026-036 as a review gate on any new operational signing
  flow or treasury-adjacent feature.

## Rules (non-negotiable)

- Dev machines do not hold production signing keys. Full stop.
- Above-threshold txs require OOB attestation via an independent
  channel; no single-device signing for that class.
- Session timeouts are enforced by the signing service, not by
  developer discipline.
- Social-engineering drills are recurring, not one-off.

## Acceptance

- [ ] `docs/runbooks/operational-signing-posture.md` landed with the
      hardening matrix, session-timeout rule, and OOB attestation
      spec.
- [ ] MDM / Gatekeeper / XProtect baseline recorded with the
      platform-team owner.
- [ ] OOB-attestation threshold and independent channel chosen and
      documented.
- [ ] Yearly social-engineering drill scheduled and the facilitator
      named.
- [ ] Cross-reference to Task 48 (TWV-2026-034 reproducible signer
      UI) and Task 50 (TWV-2026-037 hot-wallet key partition).
- [ ] PR template gains a "touches operational signing? cite
      TWV-2026-036" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Purchasing a new MDM vendor or HSM.
- Rewriting CI/CD secrets management (tracked separately).
- Bug-bounty program scoping.

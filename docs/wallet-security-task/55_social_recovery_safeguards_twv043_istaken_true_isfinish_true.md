# Task 55 — Social-recovery time-lock + pinned guardians

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-043, §7, §9

## Why this matters

Social-recovery smart accounts delegate takeover authority to M-of-N
guardians. Multiple incidents have shown that M guardians can be
compromised simultaneously — by phishing, shared cloud infra, or ENS
expiry leading to attacker-controlled guardian addresses. The time-lock
and pinned-address properties are design invariants that must exist
before a single line of social-recovery code is written.

## Scope

Design-property task. Deliverables:

- Write `docs/social-recovery-spec.md` (or extend the placeholder from
  task 51) with the following safeguards:
  - Mandatory time-lock between recovery initiation and execution
    (recommended 48–72h). No "fast path." During the window, push +
    email + SMS notifications go to the original key-holder, plus a
    persistent on-device banner.
  - Guardian addresses are pinned at enrollment. No ENS resolution at
    recovery time — the pinned raw address is what the contract uses.
    Rotating a guardian requires a current-key-signed tx.
  - At least one guardian in the set MUST be hardware-rooted (HW
    wallet / Yubikey-backed EOA) so its compromise mode is distinct
    from phone / cloud-based guardians. Enrollment UI enforces this.
  - Rate-limit recovery attempts; an on-device "recovery pending"
    banner cannot be dismissed until the time-lock elapses or the user
    cancels with the current key.
  - Guardian-bytecode monitoring: warn if any guardian address
    transitions from EOA to contract (possible EIP-7702 or
    self-destruct-redeploy hijack).
  - Independence property from task 51 is referenced and enforced in
    the enrollment UI.
- Add a pre-implementation checklist to the roadmap entry for the
  social-recovery feature. No PR that lands the feature can merge
  without passing this checklist.
- Flag TWV-2026-043 as a review gate.

## Rules (non-negotiable)

- Time-lock is contract-enforced, not UI-enforced; a malicious UI
  bypass cannot shorten it.
- Guardian addresses are raw and pinned; zero ENS-lookup code paths at
  recovery time.
- At least one hardware-rooted guardian is required at enrollment;
  enrollment cannot complete otherwise.
- Recovery attempt notifications cannot be disabled by the recovery
  initiator — they go to the original key-holder's channels.

## Acceptance

- [ ] `docs/social-recovery-spec.md` contains all six safeguards.
- [ ] Pre-implementation checklist linked from the social-recovery
      roadmap entry.
- [ ] Review gate recorded; cross-link to tasks 51 (independence) and
      58 (HW attestation) is present.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing the social-recovery smart-account contract.
- Notification backend (depends on task 31's signed-push work).
- Cross-chain guardian enrolment.

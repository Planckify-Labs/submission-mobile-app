# Social-recovery spec

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-043 (task 55). Companion: TWV-2026-039 (task 51,
independence), TWV-2026-046 (task 58, HW attestation), TWV-2026-054
(task 31, signed push notifications).

**Status:** Design-property spec. No social-recovery code ships today.
This document is the pre-implementation contract — any PR that
introduces a social-recovery flow (smart-account guardians, recovery
UI, guardian-enrollment flow) must satisfy every rule below before it
can merge.

## Pre-implementation checklist (merges block on any unchecked box)

- [ ] Time-lock between recovery initiation and execution (§1),
      contract-enforced, 48–72h.
- [ ] Guardian addresses pinned raw (§2); no ENS resolution at
      recovery time.
- [ ] At least one guardian is hardware-rooted (§3); enrollment UI
      enforces.
- [ ] Rate-limit + persistent on-device "recovery pending" banner
      (§4).
- [ ] Guardian-bytecode monitoring (§5); EOA→contract transition
      warns.
- [ ] Independence property from task 51 enforced at enrollment UI
      (§6).
- [ ] Notification channels go to the ORIGINAL key-holder and cannot
      be disabled by the recovery initiator (§7).

## 1. Mandatory time-lock

Recovery is **not** instant. Between "recovery initiated" and
"recovery executable" there is a contract-enforced delay of 48 to 72
hours (deployment-configurable within this range; under 48h is not
allowed).

Contract invariant:

```
require(block.timestamp >= recoveryInitiatedAt + TIME_LOCK_SECONDS,
        "recovery is locked");
```

- The UI does not offer a "fast path." A malicious UI cannot shorten
  the time-lock because it is contract-enforced.
- During the window the original key-holder is notified via:
  - Push notification (signed per TWV-2026-054 / task 31).
  - Email.
  - SMS (if enrolled).
  - Persistent on-device banner on any device that still has the
    current key.

The combination of channels is non-configurable by the recovery
initiator (§7).

## 2. Guardian addresses are pinned raw

At enrollment, guardian addresses are stored as raw 20-byte addresses.
The recovery contract uses the pinned address; it does NOT resolve an
ENS name or any indirection at recovery time.

Why: ENS expiry / takeover has been seen in the wild. A guardian's ENS
name expiring and being re-registered by an attacker would hand the
attacker guardian authority under any "resolve ENS at recovery time"
design.

Rules:

- Zero ENS-lookup code paths in the recovery execution flow.
- ENS is permitted at *enrollment-display* time (so the user sees
  "alice.eth" instead of "0x…") but the tx that stores the guardian
  uses the raw address resolved once at enrollment.
- Rotating a guardian requires a **current-key-signed** tx. An
  attacker who has stolen the current key can rotate guardians — that
  is the same threat model social recovery is trying to defeat. In
  practice the time-lock on rotation matches the recovery time-lock.

## 3. At least one hardware-rooted guardian

Guardian-set composition rule: **≥ 1 of N guardians must be
hardware-rooted**. Hardware-rooted candidates:

- An EOA whose key is held on a hardware wallet (Ledger, Trezor,
  Keystone, etc.).
- An EOA backed by a Yubikey / FIDO2 attested to the user's identity.
- A smart account whose signer is HW-rooted (transitive).

Why: phone-based and cloud-based guardians share compromise modes
(phishing, SIM swap, cloud-account takeover). A HW-rooted guardian
has a distinct compromise mode that does not correlate with the
user's phone.

Enrollment UI:

- The guardian-selection step refuses to complete until at least one
  guardian is HW-rooted. The UI explicitly shows the attestation /
  proof that the guardian is HW-backed.
- Re-enrollment after a guardian rotation re-checks this property.

## 4. Rate-limit + persistent banner

- At most **one** recovery attempt may be active per account at a
  time. Attempting a second recovery while one is pending returns an
  error.
- Subsequent recovery attempts after a cancellation are rate-limited:
  one per 24 hours in the first week after an attempt, tapering.
- The "recovery pending" banner is non-dismissible in the UI until
  either:
  - The time-lock elapses and recovery executes, or
  - The user cancels the recovery by signing with the current key.

## 5. Guardian-bytecode monitoring

Warn (in the account-details screen, and via a push) if any guardian
address transitions from EOA to a contract between enrollment and
signing. Concretely:

- Track `isContract` for each guardian (check `codehash` at enrollment
  and periodically).
- A guardian that becomes a contract could be an EIP-7702 delegator,
  a self-destruct-redeploy, or a takeover. Any of these break the
  trust model.
- On transition, recovery is **paused** — a new recovery cannot be
  initiated until the user either removes that guardian or explicitly
  acknowledges the transition.

## 6. Independence property (cross-link task 51)

`docs/multisig-independence-spec.md` (task 51 / TWV-2026-039) is the
source of truth for what "independent" means across guardians. Applied
here:

- No two guardians should share the same cloud infra (e.g., two
  guardians both on Google accounts recoverable via the same SIM).
- No two guardians should share the same physical location that could
  be compromised in a single incident (coffee-shop robbery style).
- The enrollment UI displays the detected overlap (e.g., "Guardians
  Alice and Bob both use Google as their recovery email domain —
  consider using guardians with different recovery channels.") The
  user can proceed anyway, but the warning is explicit.

## 7. Notification inseparability

Recovery-attempt notifications go to the **original key-holder**. The
recovery initiator cannot disable or re-route them.

- Push: signed push (task 31 / TWV-2026-054). If the device has the
  current key, a push arrives.
- Email: sent to the email enrolled at account creation. Changing the
  enrolled email requires a current-key-signed tx with the same
  time-lock as recovery.
- SMS: optional at enrollment; same constraints as email.

The recovery initiator does not see these settings and cannot modify
them through any flow in the app.

## 8. Review gate

- Any PR adding a social-recovery flow — UI, enrollment, execution,
  smart-account module — MUST reference TWV-2026-043 and the
  checklist at the top of this file.
- Smart-account roadmap entries that mention recovery MUST cross-link
  here.

## 9. Cross-links

- Task 51 / TWV-2026-039 — independence property.
- Task 58 / TWV-2026-046 — HW attestation; the HW-rooted guardian
  requirement consumes that spec.
- Task 31 / TWV-2026-054 — signed push notifications; used for the
  "recovery pending" push.
- Task 56 / TWV-2026-044 — UserOp hash binding; the recovery tx is a
  UserOp when we're on a smart-account stack.

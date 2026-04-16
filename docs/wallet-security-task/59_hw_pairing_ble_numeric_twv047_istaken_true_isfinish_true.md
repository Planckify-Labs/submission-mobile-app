# Task 59 — HW pairing: numeric-comparison BLE; warn on multi-pair

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-047, §7, §9

## Why this matters

Kraken Security Labs demonstrated that BLE pairing on HW wallets adds a
wireless attack surface — pairing initiated in an attacker-controlled
BLE environment enables companion-app spoofing. "Just Works" BLE
pairing is especially vulnerable; "numeric comparison" and "OOB"
modes are the defensible choices. TakumiAI does not today pair with
HW wallets, but if it ever does over BLE, the pairing UX must bake in
numeric-comparison confirmation and multi-pair detection.

## Scope

Design-property task. Deliverables:

- Extend `docs/hw-pairing-ux-spec.md` (from task 58) with a BLE-pairing
  section:
  - Mandatory BLE pairing mode is "numeric comparison" or "OOB." "Just
    Works" is rejected at pairing time; the user sees a clear failure
    copy and a link to vendor instructions.
  - The user must confirm on the HW device's display that the
    fingerprint / pairing code matches what the mobile app shows.
    Auto-accept is disabled in app code; the UI waits on the device
    confirmation.
  - Multi-pair detection: if the HW device reports it is already
    paired with another companion app, show a warning ("Your device is
    also paired with another app — confirm this is expected").
    Proceed only on explicit user acknowledgement.
  - Physical-security guidance copy for high-value users: "Pair HW
    wallets only with official companion apps. Treat devices from
    secondary sellers / open-box as potentially compromised."
- Add a pre-implementation checklist to the HW-pairing roadmap: BLE
  support cannot ship without numeric-comparison + multi-pair warn +
  on-device fingerprint confirmation.
- Flag TWV-2026-047 as a review gate.

## Rules (non-negotiable)

- "Just Works" pairing is never allowed. The wallet refuses to
  complete pairing in that mode.
- On-device fingerprint confirmation is user-driven; no timeout that
  auto-accepts.
- Multi-pair warning is non-dismissible in-session; the user must tap
  "Understood" before signing is enabled.
- Pairing UX is identical across iOS and Android so users' mental
  model transfers.

## Acceptance

- [ ] `docs/hw-pairing-ux-spec.md` BLE section is present with the
      four mitigations.
- [ ] Pre-implementation checklist linked from the HW-pairing roadmap
      entry.
- [ ] Review gate recorded; cross-link to task 58 (attestation).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing the BLE transport.
- USB-based HW pairing (separate code path; document separately when
  scoped).
- Cross-device pairing session sync.

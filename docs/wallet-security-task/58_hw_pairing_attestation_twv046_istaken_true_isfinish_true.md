# Task 58 — HW pairing: attestation + anti-klepto auxiliary entropy

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-046, §7, §9

## Why this matters

The Dark Skippy attack (Aug 2024) showed that malicious firmware on a
hardware wallet does not need to exfiltrate the seed directly — it
replaces ECDSA / Schnorr nonce generation with values derived from seed
chunks, and after two or three signed transactions, lattice attacks
recover the master seed. Attestation at pairing time plus anti-klepto
auxiliary-entropy protocols make this class of attack detectable.
TakumiAI does not pair with HW wallets today, but the UX spec has to
exist before the feature does.

## Scope

Design-property task. Deliverables:

- Write `docs/hw-pairing-ux-spec.md` (create if absent) with the
  following pairing-time flow:
  - Device attestation challenge: perform the vendor's attestation
    protocol before the first signing operation (Ledger
    `GET_ATTESTATION`, Trezor PIN-shared attestation, etc.). Failure
    blocks pairing.
  - Firmware-allowlist check: persist an allowlist of vendor-signed
    firmware release hashes; if the paired device reports a firmware
    not on the list, show a persistent warning banner.
  - Auxiliary-entropy / anti-klepto protocol: the wallet supplies
    additional entropy per signature; the device produces a
    public-nonce commitment; the wallet verifies the commitment
    incorporated the supplied entropy. If the device does not support
    a public-nonce scheme, the UX warns that Dark-Skippy detection is
    unavailable.
  - RFC 6979 deterministic nonces are used on the wallet's own
    software-signing path (cross-link to `services/walletService.ts`),
    combined with an auxiliary entropy leg, so the in-app signing path
    is not worse than the HW path.
- Add a pre-implementation checklist to any HW-pairing task: pairing
  UX cannot ship without attestation + allowlist + entropy-protocol
  handling.
- Flag TWV-2026-046 as a review gate on HW-pairing work.

## Rules (non-negotiable)

- No signing operation is accepted from a device that failed
  attestation; pairing is blocked, not merely warned.
- Firmware-allowlist check runs on every pairing connect, not only
  at initial enrollment.
- Aux-entropy commitment verification is mandatory when supported;
  the wallet's default posture is "anti-klepto required" for devices
  that advertise it.
- The in-app software signer uses RFC 6979 + aux entropy so we do not
  ship a worse signer than the HW path we are gating.

## Acceptance

- [ ] `docs/hw-pairing-ux-spec.md` exists with all four mitigations.
- [ ] Pre-implementation checklist added; HW-pairing roadmap entry
      cross-links.
- [ ] `services/walletService.ts` pre-implementation note on RFC 6979
      + aux entropy is captured as a design comment.
- [ ] Review gate recorded.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing the HW-pairing transport layer (BLE / USB).
- Vendor SDK selection.
- Firmware-allowlist distribution mechanism — handled in task 60.

# Task 48 — Reproducible signer UI for any future multisig

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-034, §7, §9

## Why this matters

WazirX lost ~$230M in July 2024 when Liminal's custody UI displayed
a benign Safe transaction while the signed payload actually rewrote
the multisig's implementation. Hardware wallets couldn't save the
signers — Safe calldata doesn't render meaningfully on Ledger
screens (blind-sign), and the UI layer was the single point of
compromise. The take-home: any UI between the signing key and the
raw tx must be reproducible, i.e. render the exact hash that gets
signed, verifiable from a pinned RPC call. We do not ship multisig
today — this task captures the design rule before the feature lands.

## Scope

Pre-implementation design task:

- Write `docs/design-notes/reproducible-signer-ui.md` specifying:
  - Any future multisig / custody / "approve-as-a-team" feature must
    render the exact tx hash that gets signed. The hash must be
    reproducible from the raw payload alone, without trust in any
    remote service.
  - Calldata decoding is in-process, sourced from the target
    contract's on-chain bytecode (via a pinned RPC call against the
    deployed address), not from the requesting dApp or custody
    backend.
  - For Safe-style multisigs: independently re-derive the Safe tx
    hash and cross-check against Safe Transaction Service (pairs
    with Task 25, TWV-2026-033).
  - Operational runbook entry: any tx invoking
    `changeImplementation`, `upgradeTo`, `setGuard`, or
    `setFallbackHandler` on a Safe is hash-matched before signing.
  - Second-device verification guidance for power users: display a
    QR of the signed-hash on the signing device so a secondary
    device can decode and show asset deltas independently.
- Add a pre-implementation checklist for the multisig feature PR:
  local-only hash derivation, Safe TX Service cross-check wired,
  sensitive-selector runbook entry tested, reproducibility test
  covering the WazirX pattern.
- Flag TWV-2026-034 as a review gate on any multisig / custody /
  operator-signing feature PR.

## Rules (non-negotiable)

- No UI layer is a single point of compromise; the signed hash is
  independently verifiable.
- Calldata decoding is in-process from on-chain bytecode; never
  trust a dApp-supplied or custody-backend-supplied decoding.
- Safe-adjacent implementation-upgrade selectors trip a mandatory
  hash-match step; this is a runbook item, not a soft warning.

## Acceptance

- [ ] `docs/design-notes/reproducible-signer-ui.md` landed with the
      rules and the pre-implementation checklist.
- [ ] Cross-reference recorded to Task 25 (TWV-2026-033 Safe
      tx-hash re-derivation) so the multisig integrator reuses that
      work.
- [ ] Runbook entry drafted for the sensitive-selector hash-match
      step.
- [ ] TWV-2026-034 added to the "feature review gates" index for
      any multisig PR.
- [ ] PR template gains a "multisig / custody / operator signing?
      cite TWV-2026-034" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Shipping the multisig feature (no code work in this task).
- Integrating a specific Safe SDK.
- Enterprise custody API / treasury workflow design.

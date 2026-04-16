# Task 46 — Red-pill-resistant simulator review

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-014, §7, §9

## Why this matters

Malicious contracts fingerprint simulation environments — reading
`block.prevrandao`, `block.timestamp`, `tx.origin`, `gasprice`, and
friends — to return benign state when simulated and drain funds when
mined. ZenGo disclosed this against Coinbase Wallet and several dApps
in 2022. If our pre-sign simulator (Task 17, TWV-2026-011) naively
uses default node-RPC semantics, it provides false comfort. This task
locks in the review gate and the vendor-disclosure policy.

## Scope

Design-review + vendor-audit task:

- Inventory `services/agent-executors/simulate.ts` (file named in
  spec §6 applicability) and any other simulation call site. Record
  whether simulation runs:
  - Locally against pinned node RPCs, or
  - Via a third-party service (Blockaid, Tenderly, GoPlus, etc.).
- Write `docs/design-notes/simulator-redpill.md` specifying:
  - Context randomisation: `block.prevrandao`, `block.timestamp`
    (slight jitter within tolerance), `tx.origin`, `msg.value`
    values must match realistic mined distributions.
  - Multi-provider diff: simulate against ≥ 2 independent providers
    and compare deltas; mismatches flag red-pill evasion.
  - Reputation overlay: contracts whose simulated behaviour diverges
    from their recent mined behaviour get a Blockaid/GoPlus-style
    warning even if the simulation looked benign.
  - Rule: simulation is never the sole safety signal. It is combined
    with calldata decoding (Task 08) and allowlist checks.
- If simulation is outsourced, write a vendor-disclosure request:
  a one-page question set covering context randomisation policy,
  multi-provider posture, known bypass CVEs. File the responses in
  the note.
- Flag TWV-2026-014 as a review gate on Task 17 (pre-sign
  simulation) and any future simulator swap.

## Rules (non-negotiable)

- Simulation output never suppresses calldata-decoding warnings; it
  augments them.
- If the vendor cannot document context randomisation, we treat
  their simulation as advisory and weight the decoded calldata
  heavier.
- Multi-provider diff is the minimum bar — single-provider
  simulation is not treated as authoritative for signing decisions.

## Acceptance

- [ ] `docs/design-notes/simulator-redpill.md` landed with the
      inventory and the required properties.
- [ ] Vendor-disclosure question set documented; if a vendor is in
      use, their responses are recorded.
- [ ] Cross-reference to Task 17 (TWV-2026-011 pre-sign simulation)
      so the simulator integrator consults this note.
- [ ] Rule "simulation is not the sole safety signal" recorded in
      the signer UI spec.
- [ ] PR template gains a "touches simulator or adds a safety
      warning tied to simulation? cite TWV-2026-014" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Implementing the simulator itself (Task 17, TWV-2026-011).
- Replacing the current simulation vendor.
- On-chain "canary contract" experiments for bypass detection.

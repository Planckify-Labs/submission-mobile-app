# Task 41 — Multi-RPC consensus for critical reads

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-028, §7, §9

## Why this matters

A single attacker-controlled RPC can lie about balances, allowances,
`eth_estimateGas`, and chain-id, or front-run user txs pulled out of
`eth_sendRawTransaction`. Fanning out critical reads to independent
providers and comparing results turns a single-point-of-lies into an
observable inconsistency. The spec already calls out
`services/rpc/MultiProvider.ts` as the intended home for this — this
task audits whether the current code actually enforces consensus for
the reads that matter.

## Scope

Audit + design-note task:

- Verify `services/rpc/MultiProvider.ts` exists and enumerate the
  reads it currently fans out. If the module is a stub, this task
  documents the gap and flags the implementation as a prerequisite
  for any new critical-read path.
- Write `docs/design-notes/multi-rpc-consensus.md` defining:
  - The critical-read set: balance shown on send-confirm, token
    allowance for permit/approval UX, `chainId` (from registry, not
    RPC; pairs with Task 07, TWV-2026-016), `eth_estimateGas` when
    the result gates a warning banner.
  - Minimum provider count (≥ 2 independent) and the mismatch
    policy: on disagreement, surface a warning and fall back to the
    trusted default rather than the user-added custom RPC.
  - Custom-RPC handling: user-added RPCs carry a persistent banner;
    they never satisfy the consensus quorum for a critical read.
  - Write-path posture: `eth_sendRawTransaction` routes to private
    mempool relays where available (pairs with Task 28, TWV-2026-050
    Flashbots Protect).
- Add a manual regression entry in §7.2 for "custom RPC returns
  different balance than default" and document the expected UX.
- Flag TWV-2026-028 as a review gate on any new RPC method that
  gates a user-visible safety signal.

## Rules (non-negotiable)

- A custom user-added RPC is never the sole source of a balance,
  allowance, or chain-id shown in a signing sheet.
- Mismatches between providers are surfaced, never silently resolved
  by picking the first response.
- Signing-critical `chainId` always comes from the registry; RPC
  `eth_chainId` is cross-check, not source.

## Acceptance

- [ ] Audit of `services/rpc/MultiProvider.ts` recorded in
      `docs/design-notes/multi-rpc-consensus.md`; gaps between
      current state and the design filed as follow-up tasks.
- [ ] Critical-read set enumerated and linked to the code paths
      that currently serve it.
- [ ] §7.2 manual regression row added for provider mismatch.
- [ ] PR template gains a "touches RPC read path for a safety
      signal? cite TWV-2026-028" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Implementing a full fan-out if the module is a stub (filed as a
  follow-up task with the audit).
- Choosing which third-party RPC providers we pay for.
- Flashbots Protect integration (Task 28, TWV-2026-050).

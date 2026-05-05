# Task 09 — `SuiSimulationInspector` + `services/chains/sui/simulation.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §8.2.

## Why this matters

Decoder annotations describe *intent*. Simulation describes *outcome*.
A `TransferObjects` decoded command becomes load-bearing only when
simulation confirms the user's `0x...AbC` is the source — the
`ownership.transfer-out` warning is what makes the sheet's "you will
lose 1.2 SUI" line trustworthy.

## Scope

- `services/chains/sui/simulation.ts`:
  - `simulate(client, txBytes)` wrapper around
    `client.dryRunTransactionBlock({ transactionBlock: bytes })`.
  - Maps the SDK response to `SuiSimulationSummary` per §6.
  - 2 s timeout (matches `services/bridge/inspector.ts:53` default).
  - Per-network RPC selection: mainnet → mainnet RPC, etc.
- `services/bridge/inspectors/SuiSimulationInspector.ts`:
  - Priority: 20 (matches `SolanaSimulationInspector`).
  - Mode: auto.
  - Trigger: `intent.namespace === "sui" && intent.kind === "signTransaction"`.
  - Depends on decoder fields (`sender`, `gasOwner`) — runs after Task 08
    by virtue of priority order.
  - Patches `payload.simulation`.
  - Emits annotations per §8.2:
    - `ownership.transfer-out` (warn) — every balance-change with
      `owner === sender && amount < 0n`.
    - `object.delete` (danger) — every `objectChanges` `kind === "deleted"`.
    - `object.transfer-out` (warn) — `kind === "transferred"` and
      `recipient !== sender`.
    - `publish.upgrade-cap` (info) — promotion of decoder hint to
      simulation-confirmed.
- `services/bridge/inspectors/SuiSimulationInspector.test.ts`:
  - Mock `SuiClient.dryRunTransactionBlock` for each annotation.
  - Timeout test: stub fn returns a never-resolving promise; assert
    `simulation.failed` annotation (severity: warn) after 2 s.
  - Skip when decoder did not run / failed (no `sender` field).

## Rules (non-negotiable)

- **Hard 2 s timeout.** A slow public RPC must not block the approval
  sheet. Annotations include `simulation.failed` with a `reason: "timeout"`
  hint so the sheet can render a degraded state.
- **Mocked-RPC tests only.** Do NOT hit the public mainnet from CI.
- **Honour `MultiProvider` / token-bucket pattern when available**
  (§14 risk row 4) — for v1 the public RPC is fine; revisit if QA hits
  rate limits.
- **Inspector only reads `payload.transaction`** — never re-derives
  decoded fields. The decoder owns those.

## Acceptance

- [ ] All four annotation types reachable via mocked-RPC fixtures.
- [ ] Timeout test green.
- [ ] Skip path (no decoder output) does not crash the pipeline.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Decoder (Task 08).
- Rate-limit / `MultiProvider` integration (deferred per §14).

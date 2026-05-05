# Task 08 — `SuiPtbDecoderInspector`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §8.1.

## Why this matters

A user staring at a base64 blob has no way to consent meaningfully to
`MoveCall(0x<unknown>::<unknown>::set_admin)`. The decoder turns the
opaque BCS into a structured list the sheet renders, and patches the
intent payload with `sender` / `gasOwner` / `gasBudget` so the gas
summary card has data to show.

## Scope

- `services/bridge/inspectors/SuiPtbDecoderInspector.ts`:
  - Priority: 15 (matches `SolanaProgramDecoderInspector`).
  - Mode: auto.
  - Trigger: `intent.namespace === "sui" && intent.kind === "signTransaction"`.
  - Decode: `Transaction.from(base64ToBytes(payload.transaction))` from
    `@mysten/sui/transactions`. Walk `tx.getData().commands` (or v1
    `tx.blockData.transactions` — Task 00 verifies which shape pinned
    SDK exposes).
  - Patch payload with: `sender`, `gasOwner`, `gasBudget`, `gasPrice`,
    `inputArgumentCount`, `decoded: SuiDecodedCommand[]`.
  - Emit annotations per §8.1:
    - `sender.mismatch` (warn) — `payload.address !== sender`.
    - `gas.high-budget` (warn) — `gasBudget > 100_000_000n MIST`.
    - `publish.upgrade-cap` (info) — any `Upgrade` or `Publish` command.
    - `move-call.foreign-package` (info) — every `MoveCall.package !== "0x2"`.
- `services/bridge/inspectors/SuiPtbDecoderInspector.test.ts`:
  - Hard-code a base64 PTB containing `MoveCall + TransferObjects`,
    assert the decoded shape and annotations.
  - Sender-mismatch fixture.
  - Foreign-package fixture (any non-`0x2` move call).
  - High-budget fixture.
  - Publish/Upgrade fixture.

## Rules (non-negotiable)

- **Pure decode, no RPC.** This inspector never hits the network.
  Simulation lives in Task 09.
- **Annotations are additive.** Never mutate or drop existing
  annotations from earlier inspectors (Heuristic, HTTPS).
- **Decoder shim handles both SDK shapes** during the version transition
  documented in Task 00 — `tx.getData()` and `tx.blockData`.
- **`gas.high-budget` threshold is `100_000_000n MIST` (0.1 SUI)** —
  adjust in code review if QA finds false positives. Spec §8.1 marks it
  as a tunable.

## Acceptance

- [ ] All four annotation types reachable via fixture tests.
- [ ] Decoder gracefully handles malformed BCS — emits a
      `decoder.failed` annotation (severity: warn) without crashing the
      pipeline. Sheet falls back to raw-bytes view.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Simulation / dry-run (Task 09).
- Sheet UI for decoded commands (Task 11).
- Sponsored-transaction renderer (out of milestone per §0).

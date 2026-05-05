# Task 01 — `services/chains/sui/payloads.ts` + Sui types

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §6.

## Why this matters

Every later task (adapter, inspectors, sheets, agent-context, redaction)
imports from `payloads.ts`. Locking the type surface first prevents
churn — and keeps the JSON-safe / secret-free invariants from §11.5.2
encoded in the type system instead of carried in prose.

## Scope

Create `services/chains/sui/payloads.ts` exporting per spec §6:

- `SuiNetwork = "mainnet" | "testnet" | "devnet"`
- `SuiChain = `sui:${SuiNetwork}``
- `SuiConnectPayload`
- `SuiSignInPayload` (SIWS — EIP-4361-shaped)
- `SuiSignPersonalMessagePayload` (`display: "utf8" | "base64"`)
- `SuiSignTxMode = "sign-only" | "sign-and-execute"`
- `SuiTxOptions`
- `SuiDecodedCommand` (discriminated union of MoveCall / TransferObjects /
  SplitCoins / MergeCoins / Publish / Upgrade / MakeMoveVec)
- `SuiSimulationSummary`
- `SuiSimulationWarning` (discriminated union of warning codes)
- `SuiSignTxPayload` (with `simulation?`, `decoded?`, `sender?`,
  `gasOwner?`, `gasBudget?`, `gasPrice?`, `inputArgumentCount?`)
- `SuiSwitchNetworkPayload`
- `SuiApprovalPayload` (discriminated union by `kind`)

Add `services/chains/sui/payloads.test.ts` — type-level tests via
`expectTypeOf` ensuring discriminated unions narrow correctly per `kind`.

## Rules (non-negotiable)

- **No `signAllTransactions` analogue.** Wallet Standard Sui has none —
  do NOT add a placeholder type. PTBs express batches natively (§6 note).
- **`transaction` is base64 BCS only.** No function refs, no Uint8Array.
  The injected shim normalises before the bridge sees it (§5.5).
- **`bigint` fields stay `bigint` in payloads** — the JSON-safe coercion
  to string lives in `agentContext.ts` (Task 16) and `redact.ts` (Task 17).
  The wire-side payloads carry native bigint for arithmetic.

## Acceptance

- [ ] All exports per §6 present, no extras.
- [ ] `pnpm check:syntax` passes.
- [ ] `pnpm biome:check` clean.
- [ ] No production import of `payloads.ts` yet (Task 04 starts using it).

## Out of scope

- Adapter logic (Task 04).
- Decoder population of `decoded` / `simulation` (Tasks 08, 09).

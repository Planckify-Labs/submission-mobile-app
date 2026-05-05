# Task 11 — `services/agent-executors/sui.ts` + register + extend `EXPECTED_MOBILE_TOOLS`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §7, §4.1 (error-mapping table).

## Why this matters

Agent Mode talks directly to executors — no dApp-bridge surface needed.
Once the Sui kit is registered (Task 09), exposing it to the agent is
five tools + five `EXPECTED_MOBILE_TOOLS` entries. The error-mapping
table in §4.1 ties the typed Sui errors (`SuiUnsupportedTokenKindError`
et al.) to stable `ExecutorErrorCode` values so the LLM gets useful
reasons rather than `String(err)`.

## Scope

- `services/agent-executors/sui.ts` — five tools mirroring
  `services/agent-executors/solana.ts`:
  | Tool | Maps to |
  |------|---------|
  | `get_wallet_sui_balance` | `SuiWalletKit.getNativeBalance(activeWallet.address, chain)` |
  | `get_sui_balance` | Same, but for an arbitrary `address` argument (falls back to active wallet). |
  | `send_sui` | `SuiWalletKit.sendNativeTransfer(...)`. Returns digest as `data.digest` (NOT `tx_hash` — wire schema validates `tx_hash` as 0x-hex). |
  | `get_wallet_sui_coins` | List Sui coins (CoinType + balance) via `client.getAllBalances({ owner })`. Mirrors `get_wallet_spl_tokens`. |
  | `send_sui_coin` | `SuiWalletKit.sendTokenTransfer({..., contractAddress: coinType, ...})`. |
- `services/agent-executors/index.ts`:
  - Import + register `SUI_EXECUTORS`.
  - Extend `EXPECTED_MOBILE_TOOLS` with the five tool names above.
- `services/agent-executors/types.ts`:
  - Extend `mapUnknownError` to map the typed Sui errors per spec §4.1:
    - `SuiUnsupportedTokenKindError` → `not_implemented`
    - `SuiInsufficientCoinError` → `insufficient_funds`
    - `SuiRegulatedCoinDeniedError` → `invalid_input` (descriptive
      message — name issuer if known)
    - `SuiClosedLoopPolicyDeniedError` → `invalid_input`
    - `SuiClosedLoopPolicyUnresolvedError` → `not_implemented`
- `services/agent-executors/sui.test.ts` — coverage for `get_wallet_sui_balance`,
  `send_sui`, `send_sui_coin` against a mocked `SuiClient`.

## Rules (non-negotiable)

- **`tx_hash` field discipline.** Sui transaction digests are
  base58-shaped, not 0x-hex. Putting them in `tx_hash` violates the
  wire schema. Use `data.digest` instead — see §7.2.
- **No per-tool kind branching.** `send_sui_coin` calls
  `SuiWalletKit.sendTokenTransfer`, which dispatches through
  `buildAndSendSuiCoinTransfer` and handles Coin / Regulated /
  Closed Loop transparently (Task 07). Adding kind-switches at the
  executor layer recreates the bug class §4.1 prevents.
- **Server-side coordination required.** `EXPECTED_MOBILE_TOOLS` is
  the mobile-side projection of a contract held by the server tool
  registry. Coordinate the server PR (executor:"mobile" entries for
  the five new tools) with this rollout — same pattern as the Solana
  rollout. The PR description should link the server PR.
- **No new biometric prompt for read tools.** `get_*` tools follow the
  Solana precedent — no extra gate. Only `send_*` go through the
  existing biometric prompt path inherited from
  `getSuiSignerForWallet`.

## Acceptance

- [ ] Five tools exported from `services/agent-executors/sui.ts`.
- [ ] `EXPECTED_MOBILE_TOOLS` extended with all five names.
- [ ] `mapUnknownError` returns the right `ExecutorErrorCode` for each
      Sui typed error.
- [ ] Unit tests cover happy path + at least one error mapping per
      tool.
- [ ] Linked server PR merged or staged before this lands in
      production.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Agent-mode dApp-browser surface — agent talks to executors directly,
  no bridge needed (spec §7.3).
- Telemetry / Sentry tags (Task 13).
- DApp-bridge SuiAdapter (Task 12).

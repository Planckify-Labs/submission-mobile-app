# Task 37 — Multicall3 batching for `balanceOf` aggregation

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.12b

## Why this matters

Fetching balances for 50+ tokens individually makes 50+ RPC calls. Multicall3
batches them into a single call, reducing latency and staying within rate limits.
This is the direct-RPC fallback path when the indexer is unavailable.

## Scope

Create:

- `services/rpc/multicall.ts`:
  - `batchBalanceOf(address, tokens[], chainId)` — builds a Multicall3
    `aggregate3` call that batches `balanceOf` for all tokens + native balance
    in one RPC call. Returns `Map<contractAddress, bigint>`.
  - `batchAllowance(owner, tokens[], spender, chainId)` — similar for
    `allowance` calls.
  - Generic `multicall(calls[])` for arbitrary batching.
  - Uses viem's built-in `multicall` support where possible.
  - Falls back to sequential calls if Multicall3 contract is not deployed on
    the target chain (some testnets).
- Update `DirectRPCProvider.getTokenBalances()` (from task 31) to use
  `batchBalanceOf` instead of individual calls.

## Rules (non-negotiable)

- **Multicall3 address** is standard (`0xcA11bde05977b3631167028862bE2a173976CA11`)
  on all major EVM chains. Use viem's built-in constant.
- **Batch size limit**: max 200 calls per multicall to avoid gas limit issues
  on `eth_call`. Split larger batches.
- **Failure isolation**: use `aggregate3` (not `aggregate`) so individual call
  failures don't revert the entire batch.

## Acceptance

- [ ] `batchBalanceOf` returns correct balances for native + ERC-20 tokens in one call.
- [ ] `batchAllowance` returns correct allowances in one call.
- [ ] Batches > 200 calls are split correctly.
- [ ] Individual call failure in batch does not fail the entire batch.
- [ ] Fallback to sequential calls on chains without Multicall3.
- [ ] `DirectRPCProvider.getTokenBalances()` uses multicall.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Multicall for non-balance queries.

## Depends on

- Task 31 (indexer — `DirectRPCProvider`), Task 36 (RPC multi-provider).

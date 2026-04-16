# Task 55 — Staking positions: native ETH, LSTs, ERC-4626 vaults

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.14

## Why this matters

Users hold staking positions (stETH, rETH, Aave aTokens, Yearn vaults) but
the portfolio only shows raw token balances without context. This task surfaces
the underlying value and yield information.

## Scope

Create:

- `services/staking/lstDetector.ts`:
  - Recognize known liquid staking tokens: stETH, wstETH, rETH, cbETH, etc.
  - Show underlying ETH value (e.g., 1 wstETH = 1.18 ETH) using on-chain
    exchange rates.
  - Display APY from a bundled/remote config source (updated weekly).
  - Badge in portfolio: "Staking position" with yield info.
- `services/staking/vaultDetector.ts`:
  - Detect ERC-4626 vault positions by checking `asset()` and `convertToAssets()`
    on the token contract.
  - Show underlying value (e.g., "100 yvDAI = 108.5 DAI").
  - Display vault yield rate if available.
  - "Withdraw" button → builds appropriate `redeem()`/`withdraw()` calldata →
    routes through DappBridge.
- `services/staking/ethStaking.ts`:
  - Detect beacon chain deposits via deposit contract events (from indexer).
  - Display staking status: active/pending/exiting.
  - Show rewards accrued (requires beacon chain API — see platform note below).
- `hooks/queries/useStakingPositions.ts` — TanStack Query hook that combines
  LST, vault, and native staking data.
- Portfolio integration: staking positions appear in the token list with a
  "Staking" badge, showing both the token balance and the underlying value.

## Rules (non-negotiable)

- **LST detection uses a curated allowlist** — don't auto-detect arbitrary tokens
  as LSTs. False positives are confusing.
- **ERC-4626 detection is on-demand** — only check tokens that aren't in the
  default list or LST list. Don't call `asset()` on every token.
- **Yield rates are informational** — not financial advice. Show "APY ~X%"
  not "You will earn X%".
- **Vault withdrawals go through DappBridge** — same approval flow.

## Acceptance

- [ ] stETH, wstETH, rETH, cbETH recognized as LSTs with underlying value.
- [ ] ERC-4626 vaults detected with underlying asset value.
- [ ] Vault "Withdraw" builds correct calldata and routes through DappBridge.
- [ ] Staking badges appear in portfolio.
- [ ] Native ETH staking status displayed (if beacon chain data available).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Staking initiation (deposit to Lido, Rocket Pool, etc.).
- DeFi position aggregation (Zapper/DeBank — v1.1).

## Depends on

- Task 31 (indexer), Task 32 (token balances).
- Bridge Phase 1a (for vault withdrawal routing).

## Platform note

Native ETH staking (beacon chain) requires a beacon chain API endpoint.
If not available at implementation time, implement LST + vault detection first;
native staking can be deferred.

# Task 53 — Cross-chain swap (LI.FI/Socket) + MEV protection

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.13

## Why this matters

Users hold tokens across multiple chains. Cross-chain swaps (bridge + swap in
one flow) eliminate the manual bridge → wait → swap workflow. MEV protection
prevents sandwich attacks on mainnet swaps.

## Scope

Extend swap infrastructure:

- **Cross-chain swap** (`services/swap/aggregator.ts` extension):
  - When `fromToken.chainId !== toToken.chainId`, route via LI.FI or Socket
    aggregation (via `takumipay-api`).
  - Multi-step route display: "Swap ETH → USDC on Ethereum → Bridge to Base →
    Swap USDC → ETH on Base".
  - Each step is a separate `ApprovalIntent`, shown sequentially in the
    approval flow.
  - Track bridge status between steps (pending/completed) with UI updates.
- **MEV protection** (`services/swap/mevProtection.ts`):
  - For Ethereum mainnet swaps, submit via Flashbots Protect RPC (or similar
    private mempool) by default.
  - Toggle in swap settings: "MEV Protection" on/off.
  - When enabled, swap transaction uses Flashbots RPC endpoint instead of
    the regular provider.
  - On L2s: not applicable (sequencer ordering) — toggle hidden.
  - Display "MEV Protected" badge on the swap confirmation sheet when active.

## Rules (non-negotiable)

- **Cross-chain steps are sequential** — don't send step 2 until step 1 confirms.
- **Bridge wait times must be visible** — "Waiting for bridge… ~3 min".
- **MEV protection default ON for Ethereum mainnet.** Users can disable.
- **MEV protection hidden on L2s** — don't confuse users.
- **Each step goes through DappBridge** — no shortcuts.

## Acceptance

- [ ] Cross-chain swap shows multi-step route.
- [ ] Each step executes sequentially through DappBridge.
- [ ] Bridge status tracked between steps with UI updates.
- [ ] MEV protection active by default for mainnet swaps.
- [ ] Flashbots RPC used when MEV protection is on.
- [ ] MEV toggle hidden on L2 chains.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Self-hosted aggregation (uses `takumipay-api` backend).
- Flashbots bundles (single tx protection only for v1).

## Depends on

- Task 52 (in-app swap — extends it).
- Backend: `takumipay-api` cross-chain routing endpoint.

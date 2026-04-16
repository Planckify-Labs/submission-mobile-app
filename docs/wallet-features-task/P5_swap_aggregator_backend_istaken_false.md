# Platform Task P5 — Swap aggregator backend endpoint

**Status:** Not taken
**Owner:** Backend (takumipay-api)
**Spec reference:** `wallet-features-spec.md` §4.13
**Type:** Platform integration (backend)

## Why this is separate

The in-app swap (task 52) routes through `takumipay-api` which queries swap
aggregators. This requires backend development and aggregator API key provisioning.

## Scope

- New endpoint in `takumipay-api`:
  - `POST /swap/route` — accepts swap params (fromToken, toToken, amount,
    slippage, chainId, userAddress), queries aggregator(s), returns route +
    calldata.
  - `POST /swap/cross-chain-route` — for cross-chain swaps via LI.FI/Socket.
- Aggregator integration:
  - Primary: 0x API or 1inch Fusion.
  - Cross-chain: LI.FI or Socket.
  - API key provisioning for chosen aggregators.
- Response format: route description, calldata, estimated output, gas estimate,
  price impact, minimum received.

## Acceptance

- [ ] `/swap/route` returns valid swap calldata for same-chain swaps.
- [ ] `/swap/cross-chain-route` returns multi-step route for cross-chain.
- [ ] Aggregator API keys provisioned and working.
- [ ] Response includes all fields needed by mobile swap UI.

## Depends on

- None (backend task).

## Unblocks

- Task 52 (in-app swap), Task 53 (cross-chain swap).

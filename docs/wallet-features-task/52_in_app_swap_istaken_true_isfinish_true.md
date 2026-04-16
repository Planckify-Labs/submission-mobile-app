# Task 52 — In-app swap: aggregator routing + approval sheet flow

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.13

## Why this matters

Users currently must open the dApp browser and navigate to a DEX to swap tokens.
A native swap interface is faster and safer — it pre-fills token selectors from
the portfolio and routes through the same approval flow.

## Scope

Create:

- `services/swap/aggregator.ts`:
  - `getSwapRoute(params: SwapParams): Promise<SwapRoute>` — calls `takumipay-api`
    which queries aggregators (0x, 1inch, Paraswap, or LI.FI).
  - `SwapParams`: fromToken, toToken, amount, slippage, chainId, userAddress.
  - `SwapRoute`: route description, calldata, estimated output, gas estimate,
    price impact, minimum received.
  - Returns ready-to-execute calldata for the swap.
- `app/swap.tsx` — swap screen:
  - Token selector (from/to) — pulls from user's portfolio tokens.
  - Amount input with "Max" button (accounts for gas on native token).
  - Slippage setting (default 0.5%, configurable: 0.1%, 0.5%, 1%, custom).
  - Route preview: shows aggregator source, price impact, minimum received.
  - "Swap" button → builds `ApprovalIntent<EvmSendTxPayload>` (or
    `EvmBatchCallsPayload` if approve+swap needed) → routes through `DappBridge`
    with `origin: "internal://swap"`.
- `components/swap/SwapInterface.tsx` — main swap UI component.
- `components/swap/RoutePreview.tsx` — route details display.
- `components/swap/SlippageSettings.tsx` — slippage config bottom sheet.
- **Token approval handling**: if swap requires token approval first, detect it
  and either batch (approve+swap via EIP-5792) or show sequential approval sheets.

## Rules (non-negotiable)

- **Swap execution goes through DappBridge** — same approval sheet, inspectors.
- **Price impact warning** at >2% impact, blocking confirmation at >10%.
- **Slippage validation**: warn if slippage > 1% ("High slippage — you may
  receive significantly less").
- **"Max" accounts for gas** — don't let users swap their entire native
  balance and have nothing left for gas.
- **Aggregator routing is server-side** — mobile app sends params, `takumipay-api`
  returns calldata. No aggregator SDK in the mobile app.

## Acceptance

- [ ] Swap screen shows token selectors, amount, slippage, route preview.
- [ ] Route fetched from `takumipay-api` with estimated output.
- [ ] Swap builds correct calldata and routes through DappBridge.
- [ ] Token approval handled (batch or sequential).
- [ ] Price impact warning at >2%.
- [ ] Slippage validation warns at >1%.
- [ ] "Max" accounts for gas on native token swaps.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Cross-chain swap (task 53).
- MEV protection (task 53).
- Aggregator backend in `takumipay-api` (separate backend task).

## Depends on

- Bridge Phase 1a (`DappBridge.enqueue()`).
- Bridge task 16 (EIP-5792) for batch approve+swap.
- Task 32 (token balances — for token selector).
- Backend: `takumipay-api` swap aggregator endpoint (platform dependency).

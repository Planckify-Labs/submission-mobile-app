# Task 28 — Flashbots Protect / MEV Blocker default for swap txs

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-050, §7, §9

## Why this matters

Default public RPCs broadcast pending txs to the public mempool where
searchers sandwich retail swaps. Cumulative MEV extraction from retail
wallets runs into hundreds of millions per year. Routing
`eth_sendRawTransaction` for swap-like calldata via a private relay
(Flashbots Protect, MEV Blocker, Beaverbuild) fixes this without any
new user decision at sign time.

## Scope

- In `services/rpc/MultiProvider.ts` (see spec §9), split write vs
  read endpoints. Reads use the configured public RPC; writes use a
  per-chain protected-relay endpoint where one is configured.
- Mainnet write endpoints (configurable in a constants file):
  - Flashbots Protect RPC (`https://rpc.flashbots.net`)
  - MEV Blocker (`https://rpc.mevblocker.io`)
  - Beaverbuild RPC
- Add a "swap-like calldata" heuristic (new `services/decoders/
  swap-shape.ts` or similar — see spec §9) that detects
  Uniswap universal-router, 1inch aggregator, CoW, 0x and the major
  L2 router shapes, based on function selectors + destination.
- Setting toggle "Protect My Swaps" — default ON on mainnet. User can
  disable per-chain.
- When a tx > configured threshold (e.g. $1k native equivalent) is
  about to be sent, show an inline toggle row in the signer UI that
  defaults to ON.
- Post-send, if the relay returns a receipt, render an "Execution
  quality" card comparing expected vs actual price and recommend
  enabling the relay next time if a sandwich is detected.

## Rules (non-negotiable)

- Protected-relay routing is opt-out per chain, not per tx (a
  user-friendly default).
- Reads never route via protected relays — they would reveal address
  activity to the relay operator.
- On L2s without a known protected endpoint, fall back silently to
  the public RPC; do not block the tx.

## Acceptance

- [ ] `MultiProvider` write calls on mainnet go to the configured
      protected relay when "Protect My Swaps" is ON.
- [ ] Swap-like calldata heuristic unit-tested against known selectors
      (Universal Router, 1inch v6, CoW, 0x).
- [ ] Settings toggle per chain persists and is honoured by the
      provider.
- [ ] `eth_call` / `eth_getBalance` and other reads continue to go
      through the public RPC.
- [ ] Regression: non-swap writes (ETH transfers, approvals) behave
      identically.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Per-tx user choice of relay (Flashbots vs MEVBlocker vs Beaverbuild).
- Private-mempool routing on L2s that have no established protected
  endpoint today.
- MEV-refund / back-run revenue share integrations.

# Task 35 — Pending tx tracker + speed-up / cancel flows

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.4 (pending tx tracking, speed-up/cancel)

## Why this matters

When a transaction is stuck (low gas), users need to speed it up or cancel it
without leaving the app. This is critical for production: a stuck tx blocks
the entire nonce sequence.

## Scope

Create:

- `services/history/PendingTxTracker.ts`:
  - When `EvmAdapter.executeApproval` returns a hash, register it.
  - Poll `eth_getTransactionReceipt` with exponential backoff: 2s → 4s → 8s → 15s → 30s (cap).
  - On confirmation: update status to `"confirmed"`, emit `BridgeEvent`.
  - On drop (not mined after 30 min): mark `"dropped"`, notify user.
  - Track replacement txs (speed-up/cancel link original → replacement via `replacedBy`/`replacementFor`).
- `components/history/PendingTxBanner.tsx` — banner shown at top of history
  and portfolio screens when there are pending transactions. Shows count + oldest
  pending tx age.
- `components/history/SpeedUpSheet.tsx` — bottom sheet for speed-up/cancel:
  - **Speed up**: same tx, same nonce, +20% `maxPriorityFeePerGas`.
  - **Cancel**: zero-value self-send, same nonce, +20% fee.
  - Shows original tx context: "Speeding up: Swap 1 ETH → 2500 USDC on Uniswap".
  - Both build `ApprovalIntent<EvmSendTxPayload>` routed through `DappBridge`
    with `origin: "internal://history"`.

## Rules (non-negotiable)

- **Exponential backoff is mandatory** — never fixed-interval poll.
- **Speed-up/cancel go through DappBridge** — same approval sheet, same
  inspector pipeline. No bypassing the approval flow.
- **Replacement fee must be at least +10% over original** (EIP-1559 minimum
  replacement threshold). We use +20% for reliability.
- **Persist pending tx list** in `expo-sqlite` — survives app restart.

## Acceptance

- [ ] `PendingTxTracker` correctly transitions: pending → confirmed/failed/dropped.
- [ ] Speed-up builds correct replacement tx (same nonce, +20% fee).
- [ ] Cancel builds zero-value self-send with same nonce.
- [ ] Both speed-up and cancel route through `DappBridge` approval flow.
- [ ] `PendingTxBanner` shows on portfolio/history when txs are pending.
- [ ] Pending txs survive app restart.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Push notifications for tx confirmation (task 56).
- Nonce strategy (already in bridge task 19).

## Depends on

- Task 31 (indexer), Task 34 (history types).
- Bridge task 19 (nonce strategy) for speed-up/cancel nonce handling.
- Bridge Phase 1a (`DappBridge.enqueue()`) for routing replacement intents.

# Task 54 — L2 withdrawal tracking + L1 data fee + sequencer health

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.15

## Why this matters

Optimistic rollup withdrawals take 7 days. Without tracking, users don't know
when they can finalize. L1 data fees are a significant cost on OP Stack chains
that users need to see before confirming. Sequencer outages affect all L2 writes.

## Scope

Create:

- `services/l2/withdrawalTracker.ts`:
  - Detect `L2ToL1MessagePasser` calls in transaction history.
  - Track withdrawal status: pending → challenge period → ready to finalize.
  - Show countdown timer in history detail: "Ready to finalize in 6d 14h 23m".
  - Fire push notification when withdrawal is ready to finalize.
  - "Finalize" button on the withdrawal detail screen → builds finalize tx
    on L1 → routes through DappBridge.
  - Support: OP Mainnet, Base, Arbitrum One (each has different bridge contracts).
- `services/l2/gasPriceOracle.ts`:
  - For OP Stack chains, read L1 data fee from `GasPriceOracle` precompile.
  - Display separately in tx confirmation sheet:
    "L2 execution fee: X ETH + L1 data fee: Y ETH = Total: Z ETH".
- `services/l2/sequencerHealth.ts`:
  - Health check includes sequencer status endpoint per L2.
  - When sequencer is down/delayed, show banner on portfolio and send screens:
    "Base sequencer is experiencing delays. Transactions may be slow."
  - Check on app foreground and every 5 minutes.
- Update `components/history/TransactionDetail.tsx` to show:
  - L1 data fee breakdown for L2 transactions.
  - Withdrawal countdown and finalize button for withdrawal transactions.
  - "Bridge" type badge for canonical bridge transactions.

## Rules (non-negotiable)

- **Withdrawal tracking survives app restarts** — persist state in `expo-sqlite`.
- **Countdown timer is approximate** — based on block time estimates, not exact.
  Show "approximately" in the UI.
- **L1 data fee must be shown BEFORE confirmation** — include in gas estimation
  on the approval sheet.
- **Sequencer health is informational** — don't block transactions, just warn.

## Acceptance

- [ ] OP/Arb withdrawals detected and tracked with countdown.
- [ ] Notification fires when withdrawal is ready to finalize.
- [ ] Finalize button works and routes through DappBridge.
- [ ] L1 data fee shown separately in tx confirmation for OP Stack chains.
- [ ] Sequencer health banner appears when sequencer is degraded.
- [ ] All state persists across app restarts.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- L2 deposit tracking (simpler, handled by normal tx confirmation).
- ZK rollup proof tracking (different mechanism, future spec).

## Depends on

- Task 34 (transaction history), Task 35 (pending tx tracker).
- Bridge Phase 1a (for finalize tx routing).

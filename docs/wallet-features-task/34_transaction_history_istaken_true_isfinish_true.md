# Task 34 — Transaction history indexing + decoded types

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.4

## Why this matters

The app currently has no in-app transaction history — users check Etherscan
manually. This task builds the history data layer and UI so users see all
their transactions decoded into human-readable types.

## Scope

Create:

- `services/history/types.ts` — `WalletTransaction` type with all fields from
  spec §4.4: hash, chainId, namespace, status (confirmed/pending/failed/dropped/replaced),
  from, to, value, type (native-transfer, token-transfer, token-approve,
  nft-transfer, swap, contract-interaction, contract-deploy, bridge, unknown),
  decoded info (functionName, args, tokenTransfers, nftTransfers), fee info,
  timing, nonce, replacement tracking.
- `services/history/decoder.ts` — receipt decoder that maps raw transaction
  receipts + transfer events into `WalletTransaction.decoded`:
  - Detect token transfers from `Transfer` events.
  - Detect NFT transfers from `Transfer` (721) and `TransferSingle`/`TransferBatch` (1155).
  - Detect approve calls.
  - Detect known swap router signatures (Uniswap, Sushiswap).
  - Fallback to `"unknown"` for unrecognized calldata.
- `hooks/queries/useTransactionHistory.ts` — TanStack Query hook with
  pagination (cursor-based from indexer). Returns transactions grouped by day.
- `components/history/TransactionRow.tsx` — row component: icon (type-based),
  counterparty (truncated address or ENS if available later), amount, status
  badge, timestamp.
- `components/history/TransactionDetail.tsx` — detail screen: decoded calldata,
  token transfer list, gas breakdown (gasUsed × effectiveGasPrice, feeUsd),
  block explorer link.
- `app/(tabs)/history.tsx` — history tab screen: chronological list grouped by
  day. Filter by chain, by type, by token.

## Rules (non-negotiable)

- **Cross-chain aggregation**: history from all chains merged into one timeline
  with chain badge on each row.
- **Decoder must be pure** — no network calls. It operates on data already
  fetched from the indexer.
- **Pagination**: fetch 25 transactions per page, infinite scroll.
- **Status badges** use consistent colors: confirmed=green, pending=yellow,
  failed=red, dropped=gray, replaced=blue.

## Acceptance

- [ ] `decoder.ts` correctly classifies at least: native transfer, ERC-20 transfer,
      ERC-20 approve, ERC-721 transfer, swap (Uniswap V2/V3 router), unknown.
      Unit tests with fixture receipts for each.
- [ ] `useTransactionHistory` returns paginated, day-grouped transactions.
- [ ] History screen renders with correct icons, amounts, and status badges.
- [ ] Detail screen shows gas breakdown and block explorer link.
- [ ] Cross-chain filter works (select one chain or all).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Pending tx tracking + speed-up/cancel (task 35).
- ENS resolution for counterparties (task 41).

## Depends on

- Task 31 (indexer abstraction).

## Unblocks

- Task 35 (pending tx tracker), Phase A exit criteria.

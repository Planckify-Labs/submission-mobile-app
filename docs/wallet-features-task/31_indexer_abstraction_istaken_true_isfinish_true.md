# Task 31 — `IndexerProvider` interface + registry + SQLite cache

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.1

## Why this matters

Every feature in this spec — token balances, transaction history, NFTs, approvals,
prices — needs data from an indexer. The current app fetches balances via raw
`eth_getBalance` calls with no caching. This task builds the abstraction layer
that all downstream tasks depend on. The actual provider implementation (Alchemy,
self-hosted, etc.) is a separate platform task.

## Scope

Create:

- `services/indexer/types.ts` — `IndexerProvider` interface with methods:
  `getTokenBalances`, `getTransactionHistory`, `getNFTs`, `getTokenApprovals`,
  `getTokenMetadata`, `getTokenPrices`, `resolveENS`. Plus supporting types:
  `TokenBalance`, `TokenPrice`, `HistoryOpts`, `NFTOpts`, `TokenApproval`,
  `NFTAsset`, `ENSResolution`.
- `services/indexer/DirectRPCProvider.ts` — baseline fallback using manual
  `balanceOf` multicall. No history/NFT support (methods throw "not supported").
  This is pure viem — no external platform dependency.
- `services/indexer/registry.ts` — `IndexerRegistry` that tries providers in
  priority order. On failure, falls through to next provider. Accepts any
  `IndexerProvider` implementation.
- `services/indexer/cache.ts` — `expo-sqlite` cache layer with per-type TTLs:
  - Token balances: 30s
  - Prices: 60s
  - Transaction history: 120s
  - NFT metadata: 24h
  - ENS resolution: 24h
  - Token approvals: 60s
- `hooks/queries/useIndexer.ts` — TanStack Query hook that wraps `IndexerRegistry`.
  The rest of the app imports `useIndexer()` — never calls a provider directly.

## Rules (non-negotiable)

- **Provider implementations must be swappable.** Adding a new provider means
  adding one file that implements `IndexerProvider`, not touching existing code.
- **Cache must be offline-capable.** If network is down, return stale cached
  data with a `stale: true` flag rather than throwing.
- **No React imports** in `services/indexer/*`. Only the hook in `hooks/queries/`
  touches React.
- **No vendor lock-in in the interface.** The types must not reference
  Alchemy-specific fields. Providers normalize vendor data into shared types.

## Acceptance

- [ ] `services/indexer/types.ts` exports `IndexerProvider` and all supporting types.
- [ ] `DirectRPCProvider` implements `getTokenBalances` via multicall; other methods
      throw a typed "not supported" error.
- [ ] `IndexerRegistry` falls through providers on failure (unit test with mock providers).
- [ ] `cache.ts` stores and retrieves from `expo-sqlite` with TTL expiry.
- [ ] `useIndexer()` hook returns `{ data, isLoading, isStale, error }`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Specific provider implementations (Alchemy, Moralis, self-hosted) — see
  platform task P1.
- Token spam filtering logic (task 32).
- Portfolio aggregation UI (task 33).

## Depends on

- None (this is the foundation task for Phase A).

## Unblocks

- Task 32 (token balances), 33 (prices), 34 (history), 38 (NFTs), 40 (ENS).
- Platform task P1 (indexer provider implementation).

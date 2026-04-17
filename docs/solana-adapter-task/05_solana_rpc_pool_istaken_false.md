# Task 05 — `solanaRpcPool.ts` — cluster→RPC resolver

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.12, §10.4 inv 20.

## Why this matters

Phase 1a's connect + basic signing paths need a canonical way to get
an `Rpc<SolanaRpcApi>` per cluster. Shipping per-caller RPC
construction now means every simulation / broadcast / metadata read
added in Phase 1b lives on the same pool (retries, caching, proxy
routing). Doing this once upfront prevents "each feature invents its
own `createSolanaRpc` call" drift that later reviews keep trying to
clean up.

## Scope

- `services/rpc/solanaRpcPool.ts` — exports:
  - `getSolanaRpc(cluster: SolanaCluster): Rpc<SolanaRpcApi>`.
  - `getSolanaRpcSubscriptions(cluster: SolanaCluster):
    RpcSubscriptions<SolanaRpcSubscriptionsApi> | undefined` — returns
    `undefined` when the WS URL env is unset (default for P1).
  - `clearSolanaRpcCache()` — testing hook.
- **URL resolution order:**
  1. `EXPO_PUBLIC_SOLANA_${CLUSTER}_RPC` dev override if set. In a
     production build with a custom mainnet URL set, emit a boot `warn`
     per invariant 20.
  2. First-party proxy: `${EXPO_PUBLIC_API_URL}/solana/${cluster}/rpc`.
  3. Fallback to `https://api.${cluster}.solana.com` (public default)
     only in `__DEV__`.
- **Rate-limit backoff:** on HTTP 429, exponential starting at 250 ms,
  max 3 retries, total cap 3 s. Uses `@solana/kit`'s
  `createDefaultRpcTransport`.
- **Read-only method cache:** TTL per method per cluster:
  - `getLatestBlockhash` → 1 s
  - `getAccountInfo` → 2 s
  - `getMinimumBalanceForRentExemption` → 5 min
  - Never cached: `simulateTransaction`, `sendTransaction`,
    `getSignatureStatuses`, `getTransaction`, anything accepting a
    signature.
- **In-memory LRU** keyed by `(cluster, method, stringified-params)`;
  cap 200 entries total.
- **`RpcSubscriptions`** — same env-override pattern for
  `EXPO_PUBLIC_SOLANA_${CLUSTER}_RPC_SUBSCRIPTIONS`; returns
  `undefined` if unset so polling is the default.

## Rules (non-negotiable)

- **Never ship provider API keys.** §10.4 inv 20 — a PR that adds
  `helius-rpc.com/?api-key=…` or equivalent to the client bundle
  fails review. The proxy is the production path.
- **No caching of `simulateTransaction`.** Each simulation must be
  fresh; caching can hide a drain payload the second time it's shown.
- **`Rpc` instance re-use.** Creating a new `Rpc<SolanaRpcApi>` per
  call is wasteful and thrashes keepalive. Memoize one per `(cluster,
  urlResolution)`.
- **Minimum-context slot respect.** If a consumer passes
  `minContextSlot` through (Task 20), cache key must include it.

## Acceptance

- [ ] Unit tests — 429 triggers three retries with expected delays
      (mocked clock).
- [ ] Unit tests — `getLatestBlockhash` returns cached value inside
      1 s TTL.
- [ ] Unit tests — `simulateTransaction` bypasses cache.
- [ ] Production build with `EXPO_PUBLIC_SOLANA_MAINNET_RPC=https://…`
      set emits the boot warn.
- [ ] No dApp bundle size regression > 20 KB.

## Out of scope

- Broadcast state machine (Task 20).
- Simulation inspector (Task 11).
- Adopting WebSockets in P1 (env override exists but default off).

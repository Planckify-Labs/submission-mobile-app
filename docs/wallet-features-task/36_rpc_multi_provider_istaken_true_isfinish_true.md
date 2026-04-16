# Task 36 — RPC multi-provider failover + health monitoring

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.12a, §4.12b

## Why this matters

The app currently uses a single RPC provider per chain. If that provider goes
down, the wallet becomes unusable. This task adds automatic failover, health
monitoring, and client-side rate limiting for production reliability.

## Scope

Create:

- `services/rpc/types.ts` — `RPCProvider` type: name, url, chainId, priority,
  rateLimitRpm, healthStatus (healthy/degraded/down), lastLatencyMs.
- `services/rpc/MultiProvider.ts`:
  - Per-chain provider list (2-3 providers: e.g., Alchemy primary, Infura
    secondary, public fallback).
  - Provider config loaded from remote config (updatable without app release),
    with bundled defaults as fallback.
  - Health monitoring: every 60s, ping primary provider with `eth_blockNumber`.
    If latency > 5s or error → mark degraded → failover to next priority.
    Restore after 3 consecutive healthy pings.
  - Returns a `viem` `Transport` (or wrapper) that transparently fails over.
- `services/rpc/rateLimiter.ts` — token-bucket rate limiter per provider,
  configured from `rateLimitRpm`. Requests exceeding the limit wait or
  overflow to next provider.
- Request dedup: identical `eth_call` / `eth_getBalance` calls within 2s
  window → return cached result, don't hit RPC.
- User-facing: update `app/settings/networks.tsx` to show per-chain health
  status (green/yellow/red dot). Allow user to add custom RPC endpoint
  (used as highest priority for that chain).

## Rules (non-negotiable)

- **Failover must be transparent** — callers never know which provider served
  the request.
- **Health pings are lightweight** — only `eth_blockNumber`, never full data calls.
- **Custom RPC endpoints** are stored in `expo-sqlite` and survive app updates.
- **Remote config** for provider list — don't require app release to add/remove
  providers. Bundled config is the fallback if remote config is unavailable.

## Acceptance

- [ ] `MultiProvider` serves requests from primary; fails over on error.
- [ ] Health monitor marks degraded after timeout, restores after 3 healthy pings.
- [ ] Rate limiter prevents exceeding configured RPM.
- [ ] Request dedup returns cached result for identical calls within 2s.
- [ ] Network settings screen shows health status per chain.
- [ ] Custom RPC endpoint can be added and takes highest priority.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Multicall batching (task 37).
- Sequencer health for L2s (task 54).

## Depends on

- None (can run in parallel with other Phase A tasks).

## Unblocks

- All features that make RPC calls benefit from failover.

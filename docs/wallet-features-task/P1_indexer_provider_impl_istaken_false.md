# Platform Task P1 — Indexer provider implementation

**Status:** Not taken
**Owner:** Mobile (mobile-app) + Infrastructure
**Spec reference:** `wallet-features-spec.md` §4.1
**Type:** Platform integration

## Why this is separate

The indexer provider is the main external dependency for portfolio, history,
NFT, and approval data. The team may choose Alchemy, Moralis, SimpleHash,
or build a self-hosted indexer. This task is isolated so the code tasks
(31–58) can proceed with the `IndexerProvider` interface and `DirectRPCProvider`
fallback while the provider decision is finalized.

## Options

| Provider | Coverage | Pros | Cons |
|---|---|---|---|
| **Alchemy** | Token balances, transfers, NFTs, prices, ENS | Best EVM coverage, single vendor | Vendor lock-in, cost at scale |
| **Moralis** | Similar to Alchemy | Good fallback, different rate limits | Slightly less reliable |
| **SimpleHash** | NFTs + spam scoring | Best NFT data + spam | Additional vendor, no token balances |
| **Self-hosted** | Custom indexer | Full control, no vendor dependency | Build + maintain cost |

## Scope

Implement one or more `IndexerProvider` classes:

- `services/indexer/AlchemyProvider.ts` — if Alchemy chosen.
- `services/indexer/MoralisProvider.ts` — if Moralis chosen (or as fallback).
- `services/indexer/SelfHostedProvider.ts` — if self-hosted indexer built.

Each must implement all methods in the `IndexerProvider` interface (task 31)
and normalize vendor-specific data into the shared types.

## Platform setup required

- API key provisioning and environment variable configuration.
- Rate limit tier selection and billing.
- If self-hosted: indexer infrastructure deployment.

## Acceptance

- [ ] At least one full `IndexerProvider` implementation beyond `DirectRPCProvider`.
- [ ] Provider registered in `IndexerRegistry` with correct priority.
- [ ] All `IndexerProvider` methods return data in the shared type format.
- [ ] API keys configured via environment variables.
- [ ] `pnpm check:syntax` passes.

## Depends on

- Task 31 (indexer abstraction — provides the interface to implement).

## Unblocks

- All downstream tasks that need real indexer data (32, 33, 34, 38, 48).

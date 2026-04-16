# Platform Task P4 — RPC provider API keys + remote config

**Status:** Not taken
**Owner:** Infrastructure
**Spec reference:** `wallet-features-spec.md` §4.12a
**Type:** Platform integration

## Why this is separate

Multi-provider RPC failover (task 36) needs API keys for multiple providers
and a remote config service to update the provider list without app releases.

## Scope

- Provision API keys for RPC providers:
  - Primary: Alchemy or Infura (per chain).
  - Secondary: alternate provider.
  - Fallback: public RPC endpoints (no key needed, rate-limited).
- Set up remote config service for provider list:
  - Options: Firebase Remote Config, custom endpoint on `takumipay-api`, or
    a static JSON hosted on CDN.
  - Provider config format: `{ chainId, providers: [{ name, url, priority, rateLimitRpm }] }`.
  - Must be updatable without app release.
- Configure environment variables:
  - `EXPO_PUBLIC_ALCHEMY_API_KEY` (or equivalent).
  - `EXPO_PUBLIC_INFURA_API_KEY` (or equivalent).
  - `EXPO_PUBLIC_RPC_CONFIG_URL` (remote config endpoint).

## Acceptance

- [ ] At least 2 RPC providers configured per major chain (Ethereum, Polygon, Base, Arbitrum, OP).
- [ ] Remote config endpoint returns provider list.
- [ ] API keys are provisioned and working.
- [ ] Environment variables documented.

## Depends on

- None.

## Unblocks

- Task 36 (RPC multi-provider failover).

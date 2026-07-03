# Onboarding a new DeFi protocol / pool resolver — runbook

**Owner:** DeFi Strategies (mobile-app + `api/` + `agent-api/`).
**Spec ref:** `docs/defi-pool-level-deposits-spec.md` (design & rationale),
`docs/defi-strategies-spec.md` §7 (adapter pattern), §11 (executors).

> **Status:** Operational runbook. Read this when a **new `project`
> slug shows up in DeFiLlama `/pools`** (often as several "duplicate"
> rows for the same asset — that's a multi-vault protocol) and you want
> users to deposit into it **in-app** instead of the "manual" fallback.
> The spec explains *why*; this file is the *how*, step by step.

---

## 0. The one thing to internalise

A DeFiLlama `pool` id is an **opaque UUID, not an on-chain address.**
"Matching" = turning `(project, chain, underlyingTokens, poolMeta)` from
`/pools` into the real **on-chain deposit target** (EVM contract / Solana
program id / Sui package+object id). You almost never have to reverse the
UUID — you look the address up from the protocol's own source and match.

**Fail closed.** If you can't resolve *and validate* an address with
confidence, return `null` → the pool degrades to the **manual deep-link**
path automatically. Never guess an address that routes user funds.

## 1. Decide how much work it actually is

| The new protocol is… | What you need | Effort |
|---|---|---|
| **Single market per asset/chain** (one deposit contract, e.g. Aave/Lido-style) | one **protocol adapter** with the static address baked in | low — no resolver |
| **Multi-vault & ERC-4626** (Morpho/Yearn-style — the "duplicate rows" case) | a **resolver** returning `{ kind: "erc4626", vault, asset }`; reuse the generic `Erc4626Adapter` | medium — resolver only, no new adapter |
| **Multi-market bespoke** (Morpho Blue marketId, Curve LP, Pendle) | resolver **+** a family adapter for the new `kind` | high |
| **Non-standard / not worth it** | nothing — leave it on manual deep-link (optionally add a homepage URL) | none |

> Quick classifier: if the same `(protocolSlug, assetSymbol, chainId)`
> yields **more than one** `OpportunityCache` row, it's multi-vault →
> you need a resolver. One row → single-market → an adapter is enough.

## 2. Find the protocol's API — the yield-server shortcut

**Do not hunt blind.** DeFiLlama's own yield-server repo is the map:

- The `/pools` `project` slug **==** the folder name at
  `github.com/DefiLlama/yield-server/src/adaptors/{slug}/`.
- That `index.js` *is* how DeFiLlama fetches the protocol — it shows the
  endpoint(s) and where the on-chain address lives. It's MIT-licensed;
  mirror the fetch logic.

Verified references:

| Slug | Endpoint | Address field |
|---|---|---|
| `morpho-blue` | `https://api.morpho.org/graphql` | vault `address`; market `uniqueKey` (marketId); `loanAsset.address` |
| `yearn-finance` | `https://ydaemon.yearn.fi/{chainId}/vaults/all` | vault = `p.address` (DeFiLlama poolId is derived from it) |

No clean API in the adapter? Fall back to **on-chain factory
enumeration** (read the protocol's factory/registry via RPC — see spec
§3.0 path 3). RPC-only, no third party.

> **Prefer the protocol's plain HTTPS config/address endpoint over
> pulling its SDK.** The shipped, tested Scallop adapter dropped
> `@scallop-io/sui-scallop-sdk` (sui-kit → Pyth → axios bloat) — the SDK
> only resolved the package + shared-object ids, which Scallop serves
> over HTTPS anyway. Pattern (**config not constants**): pin the immutable
> identity (coinType/decimals), *fetch* the mutable deployment ids
> (upgradable package) with a TTL cache + pinned fallback.
> `services/defi/adapters/scallop.config.ts` is the canonical Sui/Move
> reference — copy its shape for a new Move venue.

## 3. Confirm the matching keys are present

The resolver matches on fields captured from `/pools`
(`defillama.client.ts` → `OpportunityCache`):

- `poolMeta` — the vault/market **name** ("Steakhouse USDC"). The primary
  disambiguator between siblings. **If this is `null`**, matching degrades
  to `(asset + chain)` + a tvl/apy heuristic, or factory enumeration.
- `underlyingTokens[0]` → `assetContract` — the deposited asset.
- `chainName` / `chainId` / `namespace`.

If any are missing, first make sure the DeFiLlama client actually
captures them (Phase 0 of the spec) — don't work around a dropped field.

## 4. Write the resolver

Location: `api/src/strategies/targets/` (one file per family).

```ts
// api/src/strategies/targets/morpho.resolver.ts
export const MorphoResolver: PoolTargetResolver = {
  family: "morpho",
  aliases: ["morpho-blue", "morpho-aave", "morpho"], // DeFiLlama project slugs
  async resolve(pool) {
    const vaults = await fetchMorphoVaults(pool.chain); // api.morpho.org/graphql
    const match = vaults.find(
      (v) =>
        v.name === pool.poolMeta &&                       // poolMeta == vault name
        eqAddr(v.asset.address, pool.underlyingTokens?.[0]) &&
        v.chainId === resolveChainId(pool.chain),
    );
    if (!match) return null;                              // fail closed → manual
    return { kind: "erc4626", vault: match.address, asset: match.asset.address };
  },
};
```

Then **register it** (never a `switch` on slug — space-docking):

```ts
// api/src/strategies/targets/registry.ts
registerResolver(MorphoResolver);
```

The `score-opportunities` worker calls `resolveTarget(pool)` and writes
`depositTarget` on the `OpportunityCache` row.

## 5. Validate on-chain before trusting it (mandatory)

Add/extend validation for the `kind` (spec §3.2). For `erc4626`:

- `vault.asset()` **==** expected underlying, and
- `vault.totalAssets()` within a tolerance band of DeFiLlama `tvlUsd`, and
- the address answers the 4626 selector set.

Any mismatch → treat as unresolved (`depositTarget = null`). This is the
last line before funds move.

## 6. Map the target to an adapter

- `kind: "erc4626"` → **already handled** by the generic `Erc4626Adapter`
  (`services/defi/adapters/`). Nothing to write — the resolver output +
  registry lookup by `kind` is enough.
- A **new** `kind` → add a family adapter and register it
  (`services/defi/registry.ts`); resolution is by `DepositTarget.kind`
  alongside `slug`/`externalSlugs`. Keep it chain-agnostic — no
  `namespace ===` branches (CI `pnpm check:chains`).

`BuildDepositArgs.target` carries the concrete target into
`buildDeposit`. Adapters that ignore it keep their canonical market
(backward compatible).

## 7. Wire the manual deep-link (optional, cheap)

Even if in-app deposit isn't ready, give the manual path a precise link:

- **Deep-link:** add a per-protocol URL template (client-side registry,
  like `PROTOCOL_DISPLAY_NAMES`) filled from `depositTarget.address` +
  asset + chain. No storage.
- **Homepage fallback:** persist `ProtocolScoreCache.appUrl` from
  DeFiLlama `/protocol/{slug}.url` (already fetched in
  `getProtocolMetadata`, currently dropped). Protocol-level, **not**
  `OpportunityCache`.

## 8. Test before shipping

1. Pick a real `poolId` for the new slug from `OpportunityCache`.
2. Run `resolveTarget(pool)` → assert the expected vault address.
3. Run the on-chain validation (§5) against a live RPC.
4. Dry-run `buildDeposit` with a tiny amount; confirm the `to`/data.
5. Confirm a **wrong** poolMeta / stale vault resolves to `null` and the
   UI shows manual (fail-closed regression check).

## 9. Invariants (do not break)

- **LLM never passes an address.** `defi_deposit` carries `pool_id`; the
  executor re-fetches the authoritative `depositTarget` server-side
  (mirror `resolveAndGuard` in `writes.ts`). Reject address-shaped inputs.
- **Fail closed to manual**, never guess.
- **Resolvers are one isolated file each**; adding a protocol is a
  registration, never a branch in shared code.
- **User-facing errors stay friendly** (CLAUDE.md); raw resolver/API
  detail is `__DEV__`-only.
- **Cache** resolved targets in the DB; re-resolve on the poll schedule,
  not per request.

## 10. File map (where things live)

| Concern | Path |
|---|---|
| DeFiLlama fetch + field capture | `api/src/strategies/external/defillama.client.ts` |
| Scoring worker (calls `resolveTarget`) | `api/src/strategies/workers/score-opportunities.processor.ts` |
| Resolver registry + resolvers | `api/src/strategies/targets/` |
| `OpportunityCache` / `ProtocolScoreCache` schema | `api/prisma/schema.prisma` |
| Mobile adapter registry + adapters | `services/defi/registry.ts`, `services/defi/adapters/` |
| `BuildDepositArgs` / `DepositTarget` | `services/defi/types.ts` |
| Deposit executor + guards | `services/agent-executors/defi/writes.ts` |
| Grouping + card rendering | `services/defi/opportunityDisplay.ts`, `components/home/TakumiAgent/StructuredUI/cards/OpportunityListCard.tsx` |

# DeFi Pool-Level Deposits — Engineering Spec

**Status:** Implemented (Phases 0 → 2; Phase 3 long-tail docks onto the same
registry). See §11 for the resolved open questions.
**Related:** `docs/defi-strategies-spec.md` (§7 adapter, §9.1 DeFiLlama,
§11 executors, §13 backend), `defi_improvements.md` (yield-history /
`poolId` surfacing), `services/defi/opportunityDisplay.ts` (grouping).
**Add-a-protocol how-to:** `docs/runbooks/add-defi-pool-resolver.md`.

---

## 1. Goal & non-goals

### Goal

Let a user deposit into the **exact DeFiLlama pool** they picked from
`defi_list_opportunities`, not just "the protocol's canonical market for
that asset". Today a protocol like Ember exposes several USDC-on-Sui
pools (different isolated markets / vaults), each with its own APY and
TVL; the app can address none of them individually.

### Non-goals

- Rewriting the scoring/ranking pipeline (§8 of the strategies spec).
- Cross-chain zap routing (LI.FI, Phase 2 there).
- Supporting *every* pool DeFiLlama lists. We support the on-chain
  **standards and protocol families** that cover the bulk of relevant
  pools; the rest keep the existing **"manual steps required"** state.
- Letting the LLM handle on-chain addresses (explicitly forbidden — §8).

---

## 2. Problem statement — two gaps

**Gap A — most venues have no adapter.** `getDefiAdapter(slug)` returns
`null` for anything not in the registered set (`aaveV3, curve3pool,
eigenlayer, ethena, gmxV2, lido, maple, morpho, scallopSui, solanaJito,
yearnV3`). Ember → null → "manual steps required". No in-app deposit at
all, regardless of pool.

**Gap B — adapters that exist target one canonical market per asset.**
`BuildDepositArgs` carries only `{ wallet, chain, asset, amount }`
(`services/defi/types.ts`). Inside e.g. `scallopSui.ts`, the target is
resolved from the *symbol* to a single hardcoded `core.market`. There is
**no `poolId` and no market selector** anywhere on the write path
(`services/agent-executors/defi/writes.ts` → `deposit` → `resolveAndGuard`
→ `adapter.buildDeposit`). So even for Aave/Lido/Scallop, all sibling
pools collapse to one market.

`poolId` today is display/identity only; positions
(`StrategyPosition`) don't even store it.

### 2.1 Product stance — show what you can do

The list is **not useless without per-pool deposit** — as an advisor
(where's the yield, is it stable, verify on DeFiLlama) it stands alone,
and single-market venues (Aave/Lido/Scallop) are already real deposit
buttons today. What *is* harmful is the current mismatch: showing 5
indistinguishable sibling pools we can only route to one canonical
market. Fix the mismatch, not necessarily the whole resolver:

- **Immediate (no resolver):** group/dedup to one row per
  `protocol+asset+chain`, pick the executable pool, and badge each row
  **"Deposit in-app"** (resolved target + adapter) vs **"Manual"**
  (deep-link out). Removes confusion *and* is honest. This is a Phase 0.5
  that ships value before any address resolution.
- **Rule of thumb:** per-pool deposit is what *earns* the right to show
  pool-level granularity. Until it exists, collapse to the executable pool
  and never render sibling vaults the user can't pick.

**The badge maps to agent capability, not just UI.** "Deposit in-app" =
the pool is **AI-agent-executable**: the agent calls `defi_deposit
{ pool_id, … }`, the executor resolves the authoritative `depositTarget`
server-side (§6) and builds a signable tx — a real tool call the user
approves in-flow. "Manual" = the agent **cannot execute**; it hands off a
deep-link into `dapps-browser` (§9.1) where the user completes the deposit
through the protocol's own UI (still on the Takumi wallet via the
DappBridge). So `depositTarget != null` is exactly the line between "agent
can do it for you" and "agent points you to it". Guards in §8 gate every
in-app execution.

### 2.2 Architecture at a glance

**A. `depositTarget` lifecycle — the spine this spec adds.**

Everything upstream of `resolveTarget` (poll → filter → score → tier) is
the existing scoring pipeline (`defi-strategies-spec` §8) and is drawn as
one box. This spec adds the resolution step and the `depositTarget` field
that everything else keys off.

```
┌ scoring pipeline (defi-strategies-spec §8) ┐   ← ONE row per DeFiLlama pool
│ DeFiLlama /pools → filter → score → tier   │     (why siblings look duplicated)
└─────────────────────┬──────────────────────┘
                      │  ── THIS SPEC STARTS HERE ──
                      ▼
          resolveTarget(pool)                 matching keys from /pools:
          PoolTargetResolver registry ◀──────  poolMeta + underlyingTokens + chain
          (per-family §5)                      address from protocol API (§3.1)
                      │
                      ▼
          validate on-chain (§3.2)
             ok → DepositTarget  │  fail → null
                      ▼
      ┌──────────────────────────────────────────┐
      │ OpportunityCache row                       │
      │   poolId · poolMeta · assetContract        │
      │   depositTarget?   ◀── the new field       │
      └───────────────┬───────────────────┬────────┘
                      │ (read)            │ (read)
                      ▼                   ▼
          grouping + card            deposit executor
          (Diagram D)                (Diagrams B, C)
```

**B. In-app deposit sequence — the LLM never handles an address.**

```
User        Agent (LLM)      Mobile executor        Backend         Chain
 │ "earn on X"    │                │                   │              │
 │───────────────▶│ defi_deposit   │                   │              │
 │                │ {pool_id,      │                   │              │
 │                │  protocol_slug}│  ← NO address     │              │
 │                │───────────────▶│ getPool(pool_id)  │              │
 │                │                │──────────────────▶│              │
 │                │                │ depositTarget  ◀──│ authoritative │
 │                │                │ guards §8         │              │
 │                │                │ adapter by kind   │              │
 │                │                │ buildDeposit(tgt) │              │
 │  approve/sign ◀─── approval sheet (intent.wallet) ──│              │
 │───────────────────────────────▶│ submit tx ────────────────────▶ │
 │                │                │ createPosition(poolId) ─▶ Backend │
```

**C. Dispatch by `DepositTarget.kind` — the novel adapter routing (§7).**

One resolved target routes to exactly one adapter by its `kind`; a `null`
target has no adapter and is the manual path. Adding a protocol = register
a resolver + (new kind) a family adapter — never a branch.

```
DepositTarget.kind        adapter (registry lookup by kind)
──────────────────        ─────────────────────────────────
 "erc4626"        ──────▶ Erc4626Adapter    (ONE generic — all Morpho/Yearn vaults)
 "aave-v3"        ──────▶ AaveV3Adapter      ({ pool, asset })
 "scallop-market" ──────▶ ScallopSuiAdapter  (pinned coinType + config-fetched core)
 "morpho-blue"    ──────▶ MorphoBlueAdapter  ({ marketId })
 …new kind        ──────▶ register a family adapter (space-docking)
 null             ──────▶ (no adapter) → MANUAL deep-link (§9.1)
                          │
                          ▼  buildDeposit(target) → UnsignedCall → sign
```

**D. Sibling collapse — pool-granular rows → one protocol row (§9).**

```
raw OpportunityCache rows  (same protocol+asset+chain, different poolId):
  Ember·USDC·Sui  poolId=a  meta="Main"        apy 12.0  target=0x…   in-app
  Ember·USDC·Sui  poolId=b  meta="Steakhouse"  apy 12.4  target=0x…   in-app
  Ember·USDC·Sui  poolId=c  meta=null          apy 10.0  target=null  manual
        │  opportunityDisplay.ts — group by (protocol, asset, chain)
        ▼
  ┌────────────────────────────────────────────────┐
  │ Ember · USDC · Sui           best 12.4% · 3 pools│  ← one grouped row
  │   ├ Steakhouse   12.4%   [Deposit in-app]         │  badge = depositTarget != null
  │   ├ Main         12.0%   [Deposit in-app]         │
  │   └ (pool c)     10.0%   [Manual]                 │
  └────────────────────────────────────────────────┘
```

## 3. On-chain identity resolution (the crux)

A DeFiLlama `pool` is an **opaque UUID from their yield-server — not an
on-chain address.** Resolving `poolId → on-chain target` is a mapping
step with four source tiers:

### 3.0 Why a poolId is resolvable at all

The UUID is not random. DeFiLlama generates it in their open-source
**yield-server** (`github.com/DefiLlama/yield-server`), where a
**per-protocol adapter** defines the pool *from a real on-chain
contract*. So a `UUID ↔ address` mapping exists — it's just not exposed
as an address in `/pools`. Recovery paths, **free-tier first**:

1. **Registry match (primary, free & most robust).** Ignore the UUID;
   reconstruct identity from `(project, chain, underlyingTokens,
   poolMeta)` and query the protocol's own registry that returns
   addresses (§3.1), matching on asset + chain + name. (Morpho
   `blue-api`, Yearn `ydaemon`, Aave address-book, Curve API, Scallop
   address API — all free, all plain HTTPS; **prefer these over pulling a
   protocol SDK**, see §3.1.)
2. **yield-server adapter source (free, MIT).** The protocol's adapter
   file shows the exact contract read + pool-formation logic — effectively
   the free version of what `pool_old` sells. Mirror it per family.
3. **On-chain factory enumeration (free, RPC only).** Factory-based
   protocols (MetaMorpho factory, Uniswap/Curve registry) — read deployed
   vaults/pools directly from the factory and match by asset/name. Fully
   self-hosted, no third-party API.
4. **`pool_old` bridge — NOT used (Pro-gated).**
   `https://yields.llama.fi/poolsOld` embeds the contract address in
   `pool_old`, but it sits behind DeFiLlama Pro. Listed for completeness;
   the free paths above supersede it.

**Single-market shortcut:** protocols with one market per asset per chain
(Aave, Compound, Lido, Scallop's main pool) need *no* resolution —
`(protocol, chain, asset)` is already unique. The pool-resolution problem
only exists for multi-vault families (Morpho, Yearn, Pendle, Euler).

Note on payload fields: the only address-bearing fields in `/pools` are
`underlyingTokens` (the deposited asset) and `rewardTokens` — **never**
the vault/market/program. `poolMeta` is a free-text label
(`"Steakhouse USDC"`, `"0.05%"`, or `null`), not an address.

| Source | Yields | Notes |
|---|---|---|
| `underlyingTokens` (in `/pools`, **currently dropped**) | Underlying **asset** address (what you deposit) | Not the venue; use as a matching key + to fill `assetContract` |
| `poolMeta` (**dropped**) | Vault/market **name** or fee tier | Matching key, not an address |
| **Protocol canonical registry/API** | The actual vault/market address | **Primary source — resolve per family (all free)** |
| ~~`/poolsOld` → `pool_old`~~ | Legacy id embedding `{address}` | **Pro-gated — not used**; free paths supersede |

### 3.1 Per-family resolution

Use DeFiLlama fields as *matching keys* (`underlyingTokens` + `poolMeta`
+ `chain` + `symbol`), then look up the concrete target from the
protocol's own source:

| Family | On-chain target | Canonical source |
|---|---|---|
| **ERC-4626 vaults** (Morpho MetaMorpho, Yearn v3, Euler v2, Gearbox…) | vault **address** | `blue-api.morpho.org` / `ydaemon.yearn.fi` — match asset+chain+`poolMeta`. **One generic adapter covers the whole family.** |
| **Aave v3** | `{ pool, reserveAsset }` | `@bgd-labs/aave-address-book` (one Pool per chain) + reserve = `underlyingTokens[0]` |
| **Morpho Blue** (isolated) | `marketId` (bytes32) | Morpho API (keccak of loan/collateral/oracle/irm/lltv) |
| **Compound v3** | `{ comet, baseAsset }` | Compound deployment list (one Comet per base asset/chain) |
| **Curve / Uni LP** | pool contract address (+ coin index) | Curve API; `pool_old` is often the LP address for Curve |
| **Scallop (Sui)** | `{ protocolPkg, version, market, coinType }` | **No SDK** — pin per-asset `coinType`+decimals; fetch package/Version/Market from Scallop's plain address API (`sui.apis.scallop.io/addresses/{id}`), cached + pinned fallback. See `services/defi/adapters/scallop.config.ts` |
| **Solana** (Kamino/marginfi/Jito) | `{ program, reserve, mint }` | Protocol API/config endpoint (prefer over SDK) |

> **Lesson from the shipped Scallop adapter (tested & working): prefer
> the protocol's plain HTTPS config/address endpoint over pulling its
> SDK.** Scallop deliberately dropped `@scallop-io/sui-scallop-sdk` (it
> dragged in sui-kit → Pyth → axios) — the only thing the SDK really did
> was resolve the per-network package + shared-object ids, which Scallop
> also serves over HTTPS. Pattern = **config not constants**: pin the
> *immutable* identity (coinType/decimals) but **fetch the mutable
> deployment ids** (the protocol package changes on upgrade; a stale
> package aborts the call) with a TTL cache + a pinned fallback so a
> deposit never breaks on a config read. `scallop.config.ts` is the
> canonical Sui reference for any new Move-based venue.

### 3.2 On-chain validation (mandatory)

We route user funds, so a resolved candidate is **verified before use**:

- ERC-4626: `asset()` == expected underlying **and** `totalAssets()`
  within a TVL tolerance band **and** responds to the 4626 selector set.
- Aave: reserve listed & active in the Pool.
- Sui: market object exists and its `coinType` matches.

Any mismatch → `depositTarget = null` → existing "manual steps required"
fallback. **Never guess an address.**

### 3.3 Where resolution runs

Backend, at **poll/score time** (addresses are stable), stored on
`OpportunityCache`. Re-validate periodically (e.g. daily) and on cache
miss. This keeps the mobile client and the LLM out of the
address-resolution business entirely.

## 4. Data model changes

### 4.1 `DepositTarget` (discriminated union)

Lives in `services/defi/types.ts` (shared shape; backend mirrors it).

```ts
export type DepositTarget =
  | { kind: "erc4626";        vault: Address; asset: Address }
  | { kind: "aave-v3";        pool: Address;  asset: Address }
  | { kind: "morpho-blue";    marketId: Hex }
  | { kind: "compound-v3";    comet: Address; asset: Address }
  | { kind: "curve-lp";       pool: Address;  asset: Address; index: number }
  | { kind: "scallop-market"; market: string; coinType: string }
  | { kind: "solana-reserve"; program: string; reserve: string; mint: string };
```

### 4.2 Prisma (`api/prisma/schema.prisma`)

`OpportunityCache` (already `@@unique([poolId])`):

```prisma
poolMeta       String?  // DeFiLlama vault/market name — disambiguates siblings
depositTarget  Json?    // resolved DepositTarget, or null = unresolved → manual
targetResolvedAt DateTime?
```

`StrategyPosition` — pin the exact pool:

```prisma
poolId  String?  // DeFiLlama poolId the position was opened against
```

`assetContract` gets populated from `underlyingTokens[0]` (the schema
already anticipates this: *"null when not resolvable … need a later
resolver pass"*).

**Manual vs in-app — what actually needs a migration.** The schema cost
splits by path:

| Path | Needs a migration? | Detail |
|---|---|---|
| **Manual deep-link** | **No (per-pool)** | Link is templated client-side from `depositTarget` (§9.1). Only optional protocol-level `ProtocolScoreCache.appUrl`, and even that is avoidable with a static registry. |
| **In-app per-pool deposit** | **Yes — 2 columns** | `OpportunityCache.depositTarget` (+`targetResolvedAt`) and `StrategyPosition.poolId`. These are read/queried per row to build & withdraw the deposit — they can't ride in `raw`. |

Unavoidable migrations = `depositTarget` + `StrategyPosition.poolId`.
Softer touches: `assetContract` **already exists** (nullable) — just
populate it; `poolMeta` can either be a column *or* ride in the existing
`OpportunityCache.raw` Json (it's render-only, not queried) to skip a
Phase-0 migration. Today `raw` holds the *filtered* pool shape, which
already dropped `poolMeta`/`underlyingTokens` — so Phase 0 must first stop
dropping them in `defillama.client.ts` regardless of where they land.

## 5. Resolver registry — backend twin of the adapter registry

Mirror the mobile space-docking pattern (§7 strategies spec): a
`PoolTargetResolver` per family, registered — **never** a `switch` on
project slug.

```ts
interface PoolTargetResolver {
  readonly family: string;              // matched vs DeFiLlama `project`/aliases
  resolve(pool: DeFiLlamaYieldPool): Promise<DepositTarget | null>;
}
```

`api/src/strategies/targets/registry.ts` holds the map; the
`score-opportunities` worker calls `resolveTarget(pool)` and writes
`depositTarget`. New protocol = register a resolver + (if a new
`kind`) a mobile adapter that handles it. No shared branch.

### 5.1 Discovering a protocol's API (the yield-server shortcut)

Don't hunt each protocol's API blind — **DeFiLlama's yield-server repo
is the map.** The `/pools` `project` slug == the folder name at
`github.com/DefiLlama/yield-server/src/adaptors/{slug}/`, and that file
*is* how DeFiLlama fetches the protocol (endpoint + where the address
lives). MIT-licensed → mirror it. Verified live:

| Slug | Endpoint | Address field |
|---|---|---|
| `morpho-blue` | `api.morpho.org/graphql` | vault `address`; market `uniqueKey` (marketId); `loanAsset.address` |
| `yearn-finance` | `ydaemon.yearn.fi/{chainId}/vaults/all` | vault = `p.address` (the DeFiLlama poolId is derived from it) |

**Prioritisation — you don't need every API upfront.** Only protocols
that (a) appear in scored `OpportunityCache` **and** (b) are multi-vault
need a resolver:

```sql
SELECT DISTINCT "protocolSlug" FROM "OpportunityCache"; -- ∩ multi-vault, sort by TVL
```

Morpho + Yearn first (bulk of ERC-4626 TVL). No resolver yet → the pool
degrades to **manual deep-link** (§9.1) automatically — correct-by-default.
No clean API → on-chain factory enumeration (§3.0, RPC only).

**Maintenance:** protocol APIs drift → on-chain validation (§3.2) fails
closed to "manual"; resolvers are one-file isolated; diff against the
(living) yield-server folder.

## 6. Pipeline threading (server-authoritative target)

```
DeFiLlama /pools (+ poolMeta, underlyingTokens)
  → PoolTargetResolver.resolve → OpportunityCache.depositTarget
  → TOpportunity.depositTarget / poolMeta        (api/types/strategy.ts)
  → shapeOpportunity (reads.ts) — passthrough
  → card renders grouped rows (opportunityDisplay.ts), poolId per row
  → user picks a pool → agent calls defi_deposit { pool_id, protocol_slug, … }
  → executor RE-FETCHES depositTarget from backend by poolId  ← authoritative
  → adapter resolved by depositTarget.kind → buildDeposit({ …, target })
  → createPosition stores poolId
```

The LLM passes **`pool_id`, never an address**. The executor fetches the
authoritative `depositTarget` server-side (new `strategiesApi.getPool(poolId)`
or extend `getOpportunity`) — the same trust model `resolveAndGuard`
already uses for APY/tier/whitelist.

`BuildDepositArgs` gains `target?: DepositTarget` (optional → backward
compatible; adapters that ignore it keep their canonical market).

## 7. Adapter model change

Today: one adapter per `(protocol, chain)` with a hardcoded market.
New: **standard-family adapters keyed by `DepositTarget.kind`**,
parametrised by the concrete target.

- `Erc4626Adapter` — `deposit(assets, receiver)` to `target.vault`.
  Handles the entire 4626 family (Morpho/Yearn/Euler…) → the biggest
  coverage unlock from a single adapter.
- `AaveV3Adapter` generalised to take `{ pool, asset }` from target
  instead of a per-chain constant.
- `ScallopSuiAdapter` takes `{ market, coinType }` from target instead
  of `resolveScallopCoin(symbol)`.

Registry resolution adds a lookup by `kind` alongside the existing
`slug`/`externalSlugs` matching. Bespoke adapters stay valid for venues
with non-standard deposit logic.

### 7.1 Integration matrix — static hardcode vs dynamic resolve

The dividing line is **not "can vs can't"** — everything except the long
tail is depositable. It's **static (bake the address into the adapter)
vs dynamic (resolve the address at poll time, feed a generic adapter)**.
On-chain identity is per-chain: EVM contract address, Solana program id,
Sui package id + object id.

| Category | Address supply | Adapter |
|---|---|---|
| **Single market / asset / chain** (Aave, Lido, Compound, Scallop main) | static identity **pinned**; *mutable* deployment ids (e.g. an upgradable package) fetched from the protocol's config endpoint + pinned fallback ("config not constants", §3.1) | one per protocol (existing pattern) |
| **Multi-vault standard** (Morpho/Yearn = ERC-4626) | dynamic — resolved every poll (registry, free); too many to hardcode, new ones ship over time | **one generic `Erc4626Adapter`**, address as param |
| **Multi-market bespoke** (Morpho Blue, Curve LP, Pendle) | dynamic — resolved + family-specific logic | per-family adapter |
| **Long tail / non-standard** | unresolvable / not worth an adapter | **manual deep-link only** (§9.1) |

So the multi-vault venues (the ones that render as "duplicates") are the
*dynamic-resolve* set, not an impossible set. Only the last row is truly
manual-only.

## 8. Guards & security

- **No LLM-supplied addresses.** Enforced by re-fetching `depositTarget`
  server-side (§6). A `defi_deposit` call carrying an address-shaped
  field is rejected.
- **APY-drift** already per-row — fetch by `poolId`, not slug.
- **Tier ceiling / whitelist** stay `protocolSlug`-keyed (whitelisting a
  protocol implies its pools); optional per-pool tightening later.
- **On-chain validation** (§3.2) is the last line before signing.
- User-facing errors stay friendly per CLAUDE.md; raw resolver detail is
  `__DEV__`-only.

## 9. Grouping UX interplay

`opportunityDisplay.ts` groups siblings under one protocol row; `poolMeta`
(§4.2) labels each sibling ("Steakhouse USDC" vs "Main"). Drill-down
lists the pools; each carries `poolId` + `depositTarget` presence →
render depositable pools as actionable, unresolved ones as "manual
steps". This is the UX half of the same change.

### 9.1 Manual path — dApp deep-link (no new per-pool column)

The "Manual" badge (§2.1) opens the protocol's own UI in the **in-app
`dapps-browser`**, so the `DappBridge` still injects the Takumi wallet
via the normal approval flow (intent-isolated per CLAUDE.md) — "manual"
is *not* leaving the app, just depositing through the protocol's UI.

URL is two layers; **neither needs an `OpportunityCache` column**:

1. **Pool-precise deep-link** = a pure function of
   `(project, chain, depositTarget.address, asset)`. Template it in a
   small **client-side per-protocol registry** (like
   `PROTOCOL_DISPLAY_NAMES`) — no storage. Gated by the same
   `depositTarget` resolution; once we have the vault address we get both
   `buildDeposit` *and* the URL. Examples:
   - Morpho → `https://app.morpho.org/{chain}/vault/{vault}`
   - Yearn → `https://yearn.fi/vaults/{chainId}/{vault}`
   - Aave → `https://app.aave.com/reserve-overview/?underlyingAsset={asset}&marketName={market}`
2. **Protocol homepage fallback** (no template / unresolved target) =
   slow-moving metadata. DeFiLlama's `/protocol/{slug}` `url` field is
   **already fetched and currently dropped** in
   `getProtocolMetadata` — stop dropping it and persist on
   **`ProtocolScoreCache.appUrl`** (protocol-scoped), *not*
   `OpportunityCache` (per-pool → redundant across siblings + churns
   every poll). Or a static registry for the top venues.

Plumbing gap: `dapps-browser` opens to a hub with no initial-URL param
today. Add `useLocalSearchParams` there and push
`router.push({ pathname: "/dapps-browser", params: { url } })` from the
card. Prisma: optional `ProtocolScoreCache.appUrl String?` — the only
schema touch the manual path needs, and it's protocol-level.

### 9.2 UI invariant — extend, never redesign (HARD RULE)

`OpportunityListCard`'s look and interaction model are **settled and must
be preserved.** This spec only *extends* it (grouping, sibling drill-down,
in-app/manual badge). It is **not** a licence to restyle. Canonical:
[[feedback_agent_tool_card_design]] and the current
`components/home/TakumiAgent/StructuredUI/cards/OpportunityListCard.tsx`.

**Preserve — do not remove or replace:**

- **The multi-select "tap to check" deposit builder.** The checkbox +
  per-row amount + multi-pool deposit flow (selection survives paging via
  `rowKey`) stays. The *checkable unit* remains a concrete **executable**
  pool (`depositTarget != null`); grouping just changes what a row
  represents, not that you can check pools and batch-deposit across them.
  **Only in-app pools (`depositTarget != null`) are checkable.** Manual
  pools (`depositTarget == null`) render **no checkbox at all** (not a
  disabled one) — they get the deep-link affordance (§9.1) instead. So the
  multi-select builder, its selection count, and the batch "Deposit" CTA
  only ever act on in-app pools; a manual pool can never enter a batch.
- **Prev/Next pagination.** Keep the shared `PagerButton` (Prev/Next +
  "Page X of Y", `PREVIEW_COUNT` per page) for long lists — now paging
  over grouped rows. **Never** swap it for Show-all/Show-less or infinite
  scroll, and never drop it.
- **The visual identity** — `rounded-2xl` / white / `matte-black/10`
  borders, brand-red accents, bold checkbox, header icon+chip, tier pill,
  `tapFeedback()`. New affordances must adopt this language, not introduce
  a new one.

**Allowed extensions (must fit the existing language):** the "best of N
pools" subtitle, an expand/collapse for siblings, the per-row
in-app/Manual badge, and the `poolMeta` sub-label. Anything that reads as
a redesign, or that removes the checkboxes or the pager, is out of scope
for this spec.

## 10. Phasing

| Phase | Scope | Routes funds? |
|---|---|---|
| **0 — Capture** | Client captures `poolMeta` + `underlyingTokens`; fill `assetContract` + `poolMeta`. Unlocks grouping + yield-history. | No |
| **0.5 — Align UI** | Group/dedup per `protocol+asset+chain`; executability badge ("Deposit in-app" vs "Manual"); collapse siblings to the executable pool (§2.1). **Preserve multi-select builder + Prev/Next; extend, never redesign (§9.2).** | No |
| **1 — Resolve & record** | Resolver registry populates `depositTarget` (+ on-chain validation). Thread `poolId` through `defi_deposit` + `createPosition` (records intent; execution still canonical). | No |
| **2 — Execute (4626)** | `Erc4626Adapter` + `kind`-based resolution → real per-pool deposit for the 4626 family. Then `aave-v3`, `scallop-market`. | Yes |
| **3 — Long tail** | `curve-lp`, `morpho-blue`, Solana families. | Yes |

## 11. Open questions — RESOLVED

1. **Ember → bespoke, not 4626.** Ember is a Sui Move lending venue, not an
   EVM ERC-4626 vault, so Phase 2's `Erc4626Adapter` does **not** cover it. It
   needs a Sui resolver emitting a `scallop-market`-style target + the
   `ScallopSuiAdapter`-family path (Phase 3). Until that resolver is
   registered, Ember pools resolve to `depositTarget = null` → the **manual
   deep-link** path, which is correct-by-default (§5.1). No code branches on
   "Ember"; adding it is a resolver registration.
2. **New endpoint, keyed by poolId.** Added `GET /strategies/pools/:poolId`
   (`getPoolById`) rather than overloading `getOpportunity(slug)` (which keys
   by `protocolSlug` via `findFirst` and can't pin a sibling). `findUnique` on
   the `@@unique([poolId])` column pins the exact pool. Valkey-cached
   (`strategies:opp:pool:{poolId}`), invalidated by the score worker on upsert.
3. **Fixed tolerance band, stablecoins only.** `validateErc4626` requires
   `asset()` match + the 4626 selector set to respond + `totalAssets() > 0`;
   for recognised stablecoins it additionally requires on-chain TVL within
   `[tvl/10, tvl*10]` of DeFiLlama's (loose enough to survive price/timing
   drift, tight enough to catch a wrong/dust vault). Non-stables skip the USD
   band (no reliable server-side price) and rely on asset + selectors.
   Toggleable via `STRATEGIES_TARGET_VALIDATION=off` for local dev without RPC.
4. **Yes — cached on Valkey.** Resolved targets ride on the Valkey row-cache by
   poolId (the executor's authoritative re-fetch is served from Valkey, not the
   DB, on the hot path) in addition to the `OpportunityCache.depositTarget`
   column. Protocol vault-lists (Morpho/Yearn) are Valkey-cached + inflight-
   deduped in `TargetResolverService` so per-pool scoring jobs don't each hit
   the protocol API.

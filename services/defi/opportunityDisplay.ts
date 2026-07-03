/**
 * Opportunity grouping for the DeFi card (pool-level deposits spec §2.2 Diagram
 * D, §9). The scoring pipeline emits ONE OpportunityCache row per DeFiLlama
 * pool, so a multi-vault protocol (Morpho, Yearn, Ember…) shows up as several
 * "duplicate" rows for the same `(protocol, asset, chain)`. This collapses
 * those siblings into one grouped row and marks each sibling in-app vs manual —
 * removing the confusing mismatch where 5 indistinguishable pools all routed to
 * one canonical market.
 *
 * Pure + framework-free so it's unit-testable; the card renders the output.
 * The "checkable unit" stays a concrete executable pool (`inApp === true`) —
 * grouping only changes what a row *represents*, not that you check pools and
 * batch-deposit across them (§9.2).
 */

export interface RawOpportunity {
  id?: string;
  protocol_slug: string;
  chain_id?: number;
  chain_name?: string;
  namespace?: string;
  asset_symbol?: string;
  pool_id?: string;
  /** DeFiLlama vault/market name — the sibling disambiguator (§4.2). */
  pool_meta?: string | null;
  /** Protocol's own site for the manual deep-link (spec §9.1 layer 2). */
  app_url?: string | null;
  /** Executability: true ⇒ `depositTarget` resolved ⇒ AI-agent-executable
   *  in-app; false/undefined ⇒ "Manual" deep-link (§2.1). */
  in_app?: boolean;
  apy?: number | string;
  apy_7d_avg?: number | string;
  tvl_usd?: number | string;
  score?: number;
  tier?: string;
  il_exposure?: boolean;
}

export interface DisplayPool extends RawOpportunity {
  /** Stable per-pool identity for selection state; survives paging (§9.2). */
  rowKey: string;
  inApp: boolean;
  apyNum: number;
  scoreNum: number;
}

export interface OpportunityGroup {
  key: string;
  protocolSlug: string;
  assetSymbol?: string;
  chainName?: string;
  chainId?: number;
  namespace?: string;
  tier?: string;
  bestApy: number;
  bestScore: number;
  poolCount: number;
  inAppCount: number;
  /** Sorted: in-app first, then APY desc. */
  pools: DisplayPool[];
}

function toNum(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return Number.NEGATIVE_INFINITY;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

/** Stable per-pool key — poolId is `@@unique` on the backend; never the index. */
export function poolRowKey(row: RawOpportunity): string {
  return (
    row.pool_id ??
    row.id ??
    `${row.protocol_slug}|${row.asset_symbol ?? ""}|${row.pool_meta ?? ""}`
  );
}

function groupKey(row: RawOpportunity): string {
  const chain =
    row.chain_name ??
    (row.chain_id !== undefined ? `#${row.chain_id}` : (row.namespace ?? ""));
  return `${row.protocol_slug.toLowerCase()}|${(
    row.asset_symbol ?? ""
  ).toUpperCase()}|${chain.toLowerCase()}`;
}

/**
 * Group rows by `(protocol, asset, chain)` and sort:
 *   - pools within a group: in-app first, then APY desc (the executable,
 *     best-yield pool leads);
 *   - groups: safest first (best score desc), then best APY desc — mirroring
 *     the card's existing ranking so the grouping is a drop-in.
 */
export function groupOpportunities(rows: RawOpportunity[]): OpportunityGroup[] {
  const groups = new Map<string, OpportunityGroup>();

  for (const row of rows) {
    const key = groupKey(row);
    const pool: DisplayPool = {
      ...row,
      rowKey: poolRowKey(row),
      inApp: row.in_app === true,
      apyNum: toNum(row.apy),
      scoreNum: toNum(row.score),
    };
    const existing = groups.get(key);
    if (existing) {
      existing.pools.push(pool);
    } else {
      groups.set(key, {
        key,
        protocolSlug: row.protocol_slug,
        assetSymbol: row.asset_symbol,
        chainName: row.chain_name,
        chainId: row.chain_id,
        namespace: row.namespace,
        tier: row.tier,
        bestApy: Number.NEGATIVE_INFINITY,
        bestScore: Number.NEGATIVE_INFINITY,
        poolCount: 0,
        inAppCount: 0,
        pools: [pool],
      });
    }
  }

  const result: OpportunityGroup[] = [];
  for (const group of groups.values()) {
    group.pools.sort((a, b) => {
      if (a.inApp !== b.inApp) return a.inApp ? -1 : 1;
      return b.apyNum - a.apyNum;
    });
    group.poolCount = group.pools.length;
    group.inAppCount = group.pools.filter((p) => p.inApp).length;
    group.bestApy = Math.max(...group.pools.map((p) => p.apyNum));
    group.bestScore = Math.max(...group.pools.map((p) => p.scoreNum));
    // Prefer the tier of the leading (executable, best) pool for the header.
    group.tier = group.pools[0]?.tier ?? group.tier;
    result.push(group);
  }

  result.sort((a, b) => {
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return b.bestApy - a.bestApy;
  });
  return result;
}

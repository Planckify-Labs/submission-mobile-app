import { describe, expect, it } from "vitest";
import {
  groupOpportunities,
  poolRowKey,
  type RawOpportunity,
} from "@/services/defi/opportunityDisplay";

/**
 * Grouping / sibling-collapse for the DeFi card (pool-level deposits spec §9,
 * Diagram D). Ships as Phase 0.5: one row per (protocol, asset, chain), each
 * sibling badged in-app vs manual, executable pools lead.
 */

// The screenshot venue from the spec: Ember exposes several USDC-on-Sui pools.
const emberRows: RawOpportunity[] = [
  {
    protocol_slug: "ember",
    asset_symbol: "USDC",
    chain_name: "Sui",
    pool_id: "a",
    pool_meta: "Main",
    in_app: true,
    apy: 12.0,
    score: 70,
  },
  {
    protocol_slug: "ember",
    asset_symbol: "USDC",
    chain_name: "Sui",
    pool_id: "b",
    pool_meta: "Steakhouse",
    in_app: true,
    apy: 12.4,
    score: 70,
  },
  {
    protocol_slug: "ember",
    asset_symbol: "USDC",
    chain_name: "Sui",
    pool_id: "c",
    pool_meta: null,
    in_app: false,
    apy: 10.0,
    score: 70,
  },
];

describe("groupOpportunities", () => {
  it("collapses sibling pools into one (protocol, asset, chain) group", () => {
    const groups = groupOpportunities(emberRows);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.protocolSlug).toBe("ember");
    expect(g.assetSymbol).toBe("USDC");
    expect(g.chainName).toBe("Sui");
    expect(g.poolCount).toBe(3);
    expect(g.inAppCount).toBe(2);
    expect(g.bestApy).toBeCloseTo(12.4);
  });

  it("orders pools in-app first, then APY desc (executable pool leads)", () => {
    const [g] = groupOpportunities(emberRows);
    // Steakhouse (in-app, 12.4) then Main (in-app, 12.0) then the manual pool.
    expect(g.pools.map((p) => p.pool_meta)).toEqual([
      "Steakhouse",
      "Main",
      null,
    ]);
    expect(g.pools.map((p) => p.inApp)).toEqual([true, true, false]);
  });

  it("keeps different (protocol, asset, chain) triples in separate groups", () => {
    const rows: RawOpportunity[] = [
      {
        protocol_slug: "aave-v3",
        asset_symbol: "USDC",
        chain_name: "Base",
        pool_id: "1",
        in_app: true,
        apy: 4,
        score: 90,
      },
      {
        protocol_slug: "aave-v3",
        asset_symbol: "USDC",
        chain_name: "Arbitrum",
        pool_id: "2",
        in_app: true,
        apy: 5,
        score: 88,
      },
      {
        protocol_slug: "aave-v3",
        asset_symbol: "DAI",
        chain_name: "Base",
        pool_id: "3",
        in_app: true,
        apy: 3,
        score: 85,
      },
    ];
    const groups = groupOpportunities(rows);
    expect(groups).toHaveLength(3);
  });

  it("ranks groups safest-first (bestScore desc), then bestApy", () => {
    const rows: RawOpportunity[] = [
      {
        protocol_slug: "risky",
        asset_symbol: "USDC",
        chain_name: "Eth",
        pool_id: "r",
        in_app: true,
        apy: 20,
        score: 40,
      },
      {
        protocol_slug: "safe",
        asset_symbol: "USDC",
        chain_name: "Eth",
        pool_id: "s",
        in_app: true,
        apy: 4,
        score: 95,
      },
    ];
    const groups = groupOpportunities(rows);
    expect(groups.map((g) => g.protocolSlug)).toEqual(["safe", "risky"]);
  });

  it("a single-pool group is still a group (common case)", () => {
    const groups = groupOpportunities([emberRows[0]]);
    expect(groups).toHaveLength(1);
    expect(groups[0].poolCount).toBe(1);
    expect(groups[0].inAppCount).toBe(1);
  });

  it("a group of only manual pools reports inAppCount 0", () => {
    const groups = groupOpportunities([emberRows[2]]);
    expect(groups[0].inAppCount).toBe(0);
    expect(groups[0].pools[0].inApp).toBe(false);
  });
});

describe("poolRowKey", () => {
  it("is the poolId when present (stable across paging, @@unique on backend)", () => {
    expect(poolRowKey({ protocol_slug: "x", pool_id: "pid" })).toBe("pid");
  });
  it("falls back to id, then a composite key", () => {
    expect(poolRowKey({ protocol_slug: "x", id: "iid" })).toBe("iid");
    expect(
      poolRowKey({ protocol_slug: "x", asset_symbol: "USDC", pool_meta: "M" }),
    ).toBe("x|USDC|M");
  });
});

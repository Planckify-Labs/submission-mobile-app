import { beforeEach, describe, expect, it } from "vitest";
import {
  getDefiAdapter,
  getDefiAdapterForKind,
  getDefiAdapterForTarget,
  registerDefiAdapter,
} from "@/services/defi/registry";
import type {
  DefiProtocolAdapter,
  DepositTarget,
  DepositTargetKind,
} from "@/services/defi/types";

/**
 * Adapter routing by `DepositTarget.kind` (pool-level deposits spec §7). One
 * resolved target routes to exactly one adapter by its kind; a null target
 * falls back to the per-slug lookup (bespoke/legacy path).
 */

function fakeAdapter(
  slug: string,
  targetKinds?: DepositTargetKind[],
  externalSlugs?: string[],
): DefiProtocolAdapter {
  const stub = async () => ({ kind: "evm-call" as const, to: "0x0" as const, data: "0x" as const });
  return {
    slug,
    namespace: "eip155",
    kind: "yield_vault",
    chainId: 0,
    displayName: slug,
    ...(targetKinds ? { targetKinds } : {}),
    ...(externalSlugs ? { externalSlugs } : {}),
    buildDeposit: stub,
    buildWithdraw: stub,
    readPosition: async () => null,
  };
}

describe("registry kind-based routing", () => {
  beforeEach(() => {
    registerDefiAdapter(fakeAdapter("erc4626", ["erc4626"]));
    registerDefiAdapter(fakeAdapter("aave-v3-base", ["aave-v3"]));
    registerDefiAdapter(fakeAdapter("morpho-steakhouse", undefined, ["morpho-blue"]));
  });

  it("routes a kind to the adapter declaring it in targetKinds", () => {
    expect(getDefiAdapterForKind("erc4626")?.slug).toBe("erc4626");
    expect(getDefiAdapterForKind("aave-v3")?.slug).toBe("aave-v3-base");
  });

  it("returns null for a kind no adapter declares", () => {
    expect(getDefiAdapterForKind("curve-lp")).toBeNull();
  });

  it("prefers the kind adapter over the slug when a target is present", () => {
    const target: DepositTarget = {
      kind: "erc4626",
      vault: "0xvault" as `0x${string}`,
      asset: "0xasset" as `0x${string}`,
    };
    // slug is a bespoke morpho vault, but the erc4626 target must win.
    const adapter = getDefiAdapterForTarget("morpho-steakhouse", target);
    expect(adapter?.slug).toBe("erc4626");
  });

  it("falls back to the slug lookup when there is no target", () => {
    const adapter = getDefiAdapterForTarget("morpho-steakhouse", null);
    expect(adapter?.slug).toBe("morpho-steakhouse");
  });

  it("falls back to slug (incl. externalSlugs) for an unhandled target kind", () => {
    const target: DepositTarget = {
      kind: "curve-lp",
      pool: "0xpool" as `0x${string}`,
      asset: "0xasset" as `0x${string}`,
      index: 0,
    };
    // No adapter declares curve-lp → falls back to the slug/externalSlug match.
    expect(getDefiAdapterForTarget("morpho-blue", target)?.slug).toBe(
      "morpho-steakhouse",
    );
    expect(getDefiAdapter("morpho-blue")?.slug).toBe("morpho-steakhouse");
  });
});

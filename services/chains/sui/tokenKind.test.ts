/**
 * Unit tests for `services/chains/sui/tokenKind.ts`.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §4.1.
 *
 * The detector touches several JSON-RPC methods on `SuiJsonRpcClient`,
 * but its semantics in v1 are mostly about branching on
 * `getCoinMetadata` (Coin<T> vs Closed-Loop / NFT). We exercise that
 * core branch + the cache invariant. Regulated detection and
 * closed-loop policy resolution are intentionally heuristic for v1
 * (see TODO(task-07-followup) comments in the implementation), so we
 * only assert the contract: deny-list errors fall back to
 * `regulated: false`, and an unresolved policy returns `null`.
 *
 * The mock client is hand-built and cast through `as never` because
 * the SDK's `SuiJsonRpcClient` is large — full mocks aren't worthwhile
 * for branch-coverage unit tests.
 */

import { describe, expect, it, vi } from "vitest";

import { clearSuiTokenKindCache, detectSuiTokenKind } from "./tokenKind.ts";

const COIN_TYPE = "0x2::sui::SUI";
const REGULATED_COIN_TYPE = "0xdee9::stable_coin::USDC";
const CLOSED_LOOP_TYPE = "0xface::loyalty::POINT";

interface MockClient {
  getCoinMetadata: ReturnType<typeof vi.fn>;
  getDynamicFieldObject: ReturnType<typeof vi.fn>;
  queryEvents: ReturnType<typeof vi.fn>;
}

function makeMock(overrides: Partial<MockClient> = {}): MockClient {
  return {
    getCoinMetadata: vi.fn().mockResolvedValue(null),
    getDynamicFieldObject: vi.fn().mockResolvedValue({ data: null }),
    queryEvents: vi.fn().mockResolvedValue({ data: [] }),
    ...overrides,
  };
}

describe("detectSuiTokenKind — Coin<T> branch", () => {
  it("returns regulated:false when getCoinMetadata resolves and deny lookup is empty", async () => {
    clearSuiTokenKindCache();
    const mock = makeMock({
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 9 }),
    });

    const kind = await detectSuiTokenKind(mock as never, COIN_TYPE, {
      network: "test-1",
    });

    expect(kind).not.toBeNull();
    if (kind && kind.kind === "coin" && !kind.regulated) {
      expect(kind.decimals).toBe(9);
    } else {
      throw new Error(
        `expected non-regulated coin kind, got ${JSON.stringify(kind)}`,
      );
    }
  });

  it("returns regulated:true when deny list lookup surfaces an objectId", async () => {
    clearSuiTokenKindCache();
    const denyId = "0xbeef";
    const mock = makeMock({
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 6 }),
      getDynamicFieldObject: vi
        .fn()
        .mockResolvedValue({ data: { objectId: denyId } }),
    });

    const kind = await detectSuiTokenKind(mock as never, REGULATED_COIN_TYPE, {
      network: "test-2",
    });

    if (kind && kind.kind === "coin" && kind.regulated) {
      expect(kind.decimals).toBe(6);
      expect(kind.denyListId).toBe(denyId);
    } else {
      throw new Error(
        `expected regulated coin kind, got ${JSON.stringify(kind)}`,
      );
    }
  });

  it("treats deny-list lookup errors as non-regulated", async () => {
    clearSuiTokenKindCache();
    const mock = makeMock({
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 8 }),
      getDynamicFieldObject: vi
        .fn()
        .mockRejectedValue(new Error("rpc unavailable")),
    });

    const kind = await detectSuiTokenKind(mock as never, COIN_TYPE, {
      network: "test-3",
    });

    if (kind && kind.kind === "coin" && !kind.regulated) {
      expect(kind.decimals).toBe(8);
    } else {
      throw new Error(
        `expected non-regulated coin kind, got ${JSON.stringify(kind)}`,
      );
    }
  });
});

describe("detectSuiTokenKind — Closed Loop branch", () => {
  it("returns null when neither path resolves (NFT / unknown)", async () => {
    clearSuiTokenKindCache();
    const mock = makeMock();
    const kind = await detectSuiTokenKind(mock as never, CLOSED_LOOP_TYPE, {
      network: "test-4",
    });
    expect(kind).toBeNull();
  });

  it("returns kind:closed-loop when queryEvents surfaces a policy", async () => {
    clearSuiTokenKindCache();
    const policyId = "0xpolicy";
    const mock = makeMock({
      queryEvents: vi.fn().mockResolvedValue({
        data: [{ parsedJson: { policy_id: policyId, decimals: 2 } }],
      }),
    });

    const kind = await detectSuiTokenKind(mock as never, CLOSED_LOOP_TYPE, {
      network: "test-5",
    });

    if (kind && kind.kind === "closed-loop") {
      expect(kind.tokenPolicyId).toBe(policyId);
      expect(kind.decimals).toBe(2);
    } else {
      throw new Error(`expected closed-loop kind, got ${JSON.stringify(kind)}`);
    }
  });
});

describe("detectSuiTokenKind — caching", () => {
  it("does not call getCoinMetadata twice for the same (network, coinType) pair", async () => {
    clearSuiTokenKindCache();
    const meta = vi.fn().mockResolvedValue({ decimals: 9 });
    const mock = makeMock({ getCoinMetadata: meta });

    await detectSuiTokenKind(mock as never, COIN_TYPE, { network: "cached" });
    await detectSuiTokenKind(mock as never, COIN_TYPE, { network: "cached" });

    expect(meta).toHaveBeenCalledTimes(1);
  });

  it("treats a different network as a different cache key", async () => {
    clearSuiTokenKindCache();
    const meta = vi.fn().mockResolvedValue({ decimals: 9 });
    const mock = makeMock({ getCoinMetadata: meta });

    await detectSuiTokenKind(mock as never, COIN_TYPE, { network: "mainnet" });
    await detectSuiTokenKind(mock as never, COIN_TYPE, { network: "testnet" });

    expect(meta).toHaveBeenCalledTimes(2);
  });

  it("clearSuiTokenKindCache() forces a re-read", async () => {
    clearSuiTokenKindCache();
    const meta = vi.fn().mockResolvedValue({ decimals: 9 });
    const mock = makeMock({ getCoinMetadata: meta });

    await detectSuiTokenKind(mock as never, COIN_TYPE, { network: "x" });
    clearSuiTokenKindCache();
    await detectSuiTokenKind(mock as never, COIN_TYPE, { network: "x" });

    expect(meta).toHaveBeenCalledTimes(2);
  });
});

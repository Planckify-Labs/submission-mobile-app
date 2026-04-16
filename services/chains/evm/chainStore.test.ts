/**
 * Tests for TWV-2026-016 signing-chainId invariant.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/chains/evm/chainStore.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSigningChainId, verifyRpcChainId } from "./signingChainId.ts";

describe("getSigningChainId — registry is the source of truth", () => {
  it("returns the registry chainId unchanged", () => {
    assert.equal(getSigningChainId(1), 1);
    assert.equal(getSigningChainId(10), 10);
    assert.equal(getSigningChainId(8453), 8453);
  });
});

describe("verifyRpcChainId — deceptive-RPC detector", () => {
  it("flags a mismatch when RPC reports a different chainId", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x89" }), {
        status: 200,
      })) as typeof fetch;
    try {
      const out = await verifyRpcChainId(1, "https://rpc.attacker.test");
      assert.equal(out.match, false);
      assert.equal(out.reported, 0x89);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("reports match when RPC agrees with registry", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), {
        status: 200,
      })) as typeof fetch;
    try {
      const out = await verifyRpcChainId(1, "https://rpc.test");
      assert.equal(out.match, true);
      assert.equal(out.reported, 1);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("is best-effort on transport failure (does NOT flag a mismatch)", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    try {
      const out = await verifyRpcChainId(1, "https://rpc.dead.test");
      assert.equal(out.match, true);
      assert.equal(out.reported, null);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

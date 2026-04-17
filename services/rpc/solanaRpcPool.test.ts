/**
 * Unit tests for `solanaRpcPool`. Verifies the task-05 acceptance
 * criteria: 429 retries, read-only caching, no cache for simulate.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/rpc/solanaRpcPool.test.ts
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  __setRpcFactoryForTests,
  clearSolanaRpcCache,
  getSolanaRpc,
  getSolanaRpcSubscriptions,
} from "./solanaRpcPool.ts";

// Fake RPC whose counters the tests inspect.
let sendCalls: Record<string, number> = {};
let failNext429: Record<string, number> = {};

function makeFake() {
  const make =
    (name: string) => () => ({
      send: async () => {
        sendCalls[name] = (sendCalls[name] ?? 0) + 1;
        if ((failNext429[name] ?? 0) > 0) {
          failNext429[name] -= 1;
          const err = new Error("429 Too Many Requests") as Error & {
            status?: number;
          };
          err.status = 429;
          throw err;
        }
        return name === "getLatestBlockhash"
          ? { blockhash: "h1" }
          : { value: { err: null } };
      },
    });
  return {
    getLatestBlockhash: make("getLatestBlockhash"),
    simulateTransaction: make("simulateTransaction"),
  };
}

beforeEach(() => {
  clearSolanaRpcCache();
  sendCalls = {};
  failNext429 = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setRpcFactoryForTests(() => makeFake() as any);
});

describe("getSolanaRpc — retry on 429", () => {
  it("retries up to 3 times with backoff, then resolves", async () => {
    failNext429.getLatestBlockhash = 2;
    const rpc = getSolanaRpc("devnet");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (await (rpc as any)
      .getLatestBlockhash()
      .send()) as { blockhash: string };
    assert.equal(res.blockhash, "h1");
    assert.equal(sendCalls.getLatestBlockhash, 3);
  });

  it("throws after exhausting retries", async () => {
    failNext429.getLatestBlockhash = 5;
    const rpc = getSolanaRpc("devnet");
    await assert.rejects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (rpc as any).getLatestBlockhash().send(),
      /429/,
    );
    assert.equal(sendCalls.getLatestBlockhash, 3);
  });
});

describe("getSolanaRpc — cache TTL", () => {
  it("serves cached getLatestBlockhash within TTL", async () => {
    const rpc = getSolanaRpc("mainnet-beta");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (await (rpc as any)
      .getLatestBlockhash()
      .send()) as { blockhash: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = (await (rpc as any)
      .getLatestBlockhash()
      .send()) as { blockhash: string };
    assert.deepEqual(first, second);
    assert.equal(sendCalls.getLatestBlockhash, 1);
  });

  it("never caches simulateTransaction", async () => {
    const rpc = getSolanaRpc("mainnet-beta");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (rpc as any).simulateTransaction().send();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (rpc as any).simulateTransaction().send();
    assert.equal(sendCalls.simulateTransaction, 2);
  });
});

describe("getSolanaRpcSubscriptions", () => {
  it("returns undefined by default (P1 polling path)", () => {
    assert.equal(getSolanaRpcSubscriptions("mainnet-beta"), undefined);
    assert.equal(getSolanaRpcSubscriptions("devnet"), undefined);
  });
});

/**
 * Unit tests for `buildExplorerUrl`.
 *
 * Same runner as `services/permissionGrantStore.test.ts` — plain
 * `node:test` with type stripping. Runs from the mobile-app root:
 *
 *     node --test --experimental-strip-types \
 *       components/home/TakumiAgent/PendingTxCard/explorerUrl.test.ts
 *
 * `chainConfig.ts` pulls its data from viem/chains, which is plain
 * JS and needs no React / native runtime, so this test file can run
 * under Node unchanged.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExplorerUrl } from "./explorerUrl.ts";

const SAMPLE_HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("buildExplorerUrl", () => {
  it("returns the polygonscan URL for polygon (chainId 137)", () => {
    const url = buildExplorerUrl(137, SAMPLE_HASH);
    assert.ok(url, "polygon explorer URL should exist");
    assert.match(url, /polygonscan\.com/);
    assert.ok(url.endsWith(`/tx/${SAMPLE_HASH}`));
  });

  it("returns the etherscan URL for mainnet (chainId 1)", () => {
    const url = buildExplorerUrl(1, SAMPLE_HASH);
    assert.ok(url, "ethereum explorer URL should exist");
    assert.match(url, /etherscan\.io/);
    assert.ok(url.endsWith(`/tx/${SAMPLE_HASH}`));
  });

  it("returns undefined for an unknown chain_id", () => {
    // 999999 is not in supportedChains.
    const url = buildExplorerUrl(999999, SAMPLE_HASH);
    assert.equal(url, undefined);
  });

  it("returns undefined for chain_id = 0", () => {
    assert.equal(buildExplorerUrl(0, SAMPLE_HASH), undefined);
  });

  it("returns undefined for an empty hash", () => {
    assert.equal(buildExplorerUrl(1, ""), undefined);
  });

  it("does not produce a double slash if the explorer base already has a trailing slash", () => {
    const url = buildExplorerUrl(1, SAMPLE_HASH);
    assert.ok(url);
    assert.ok(!url.includes("//tx/"));
  });
});

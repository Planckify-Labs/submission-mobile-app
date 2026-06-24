/**
 * Behavioural test for `namespaceForChainKey` — the helper that lets the
 * dApp-bridge disconnect path and the connection-manager UI recover a
 * grant's chain namespace from its stored `chainId`, without persisting a
 * separate namespace field.
 *
 * Contract mirrors what each adapter writes at grant time:
 *   - EVM   → numeric chainId            (EvmAdapter)
 *   - Solana → "solana:<cluster>"        (clusterToChain)
 *   - Sui   → "sui:<network>"            (networkToChain)
 *
 * Runs under the node:test harness (scripts/run-node-tests.sh); the
 * resolver stubs expo-secure-store + AsyncStorage so store.ts loads.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { namespaceForChainKey } from "./store.ts";

describe("namespaceForChainKey", () => {
  it("maps numeric chainIds to eip155", () => {
    assert.equal(namespaceForChainKey(1), "eip155");
    assert.equal(namespaceForChainKey(137), "eip155");
    assert.equal(namespaceForChainKey(8453), "eip155");
  });

  it("maps CAIP-2 solana clusters to solana", () => {
    assert.equal(namespaceForChainKey("solana:mainnet"), "solana");
    assert.equal(namespaceForChainKey("solana:devnet"), "solana");
    assert.equal(namespaceForChainKey("solana:testnet"), "solana");
  });

  it("maps CAIP-2 sui networks to sui", () => {
    assert.equal(namespaceForChainKey("sui:mainnet"), "sui");
    assert.equal(namespaceForChainKey("sui:testnet"), "sui");
    assert.equal(namespaceForChainKey("sui:devnet"), "sui");
  });

  it("falls back to eip155 for unrecognised string keys", () => {
    assert.equal(namespaceForChainKey("0x1"), "eip155");
    assert.equal(namespaceForChainKey(""), "eip155");
  });
});

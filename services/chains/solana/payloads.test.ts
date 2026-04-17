/**
 * Unit tests for `services/chains/solana/payloads.ts`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/solana/payloads.test.ts
 *
 * Covers the task 02 acceptance criterion: canonicalizeChain round-trips
 * short-form, maps genesis-hash form to short-form, and throws -32602 for
 * unknown identifiers.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalizeChain,
  chainToCluster,
  clusterToChain,
} from "./payloads.ts";

describe("canonicalizeChain", () => {
  it("round-trips short-form identifiers unchanged", () => {
    assert.equal(canonicalizeChain("solana:mainnet"), "solana:mainnet");
    assert.equal(canonicalizeChain("solana:devnet"), "solana:devnet");
    assert.equal(canonicalizeChain("solana:testnet"), "solana:testnet");
  });

  it("maps genesis-hash CAIP-2 form to short-form", () => {
    assert.equal(
      canonicalizeChain("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"),
      "solana:mainnet",
    );
    assert.equal(
      canonicalizeChain("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
      "solana:devnet",
    );
    assert.equal(
      canonicalizeChain("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z"),
      "solana:testnet",
    );
  });

  it("throws -32602 on unknown identifier", () => {
    try {
      canonicalizeChain("solana:bogus");
      assert.fail("expected throw");
    } catch (err) {
      assert.equal((err as Error & { code?: number }).code, -32602);
    }
  });

  it("throws -32602 on non-solana namespace", () => {
    try {
      canonicalizeChain("eip155:1");
      assert.fail("expected throw");
    } catch (err) {
      assert.equal((err as Error & { code?: number }).code, -32602);
    }
  });
});

describe("chainToCluster / clusterToChain", () => {
  it("bidirectional mapping round-trips", () => {
    assert.equal(clusterToChain("mainnet-beta"), "solana:mainnet");
    assert.equal(clusterToChain("devnet"), "solana:devnet");
    assert.equal(clusterToChain("testnet"), "solana:testnet");

    assert.equal(chainToCluster("solana:mainnet"), "mainnet-beta");
    assert.equal(chainToCluster("solana:devnet"), "devnet");
    assert.equal(chainToCluster("solana:testnet"), "testnet");
  });

  it("chainToCluster accepts genesis-hash form", () => {
    assert.equal(
      chainToCluster("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"),
      "mainnet-beta",
    );
  });
});

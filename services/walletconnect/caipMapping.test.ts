/**
 * CAIP-2 mapping round-trip tests. Sui task 21 — verify both directions
 * symmetric for sui:mainnet / sui:testnet / sui:devnet without disturbing
 * the existing eip155 / solana mappings.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountToCaip10,
  caip2ToNamespace,
  caipReferenceToStellarNetwork,
  namespaceToCaip2,
  stellarNetworkToCaipReference,
} from "./caipMapping.ts";

describe("caip2ToNamespace — sui", () => {
  it("recognises sui:mainnet", () => {
    const r = caip2ToNamespace("sui:mainnet");
    assert.deepEqual(r, { namespace: "sui", chainId: 1 });
  });

  it("recognises sui:testnet", () => {
    const r = caip2ToNamespace("sui:testnet");
    assert.deepEqual(r, { namespace: "sui", chainId: 2 });
  });

  it("recognises sui:devnet", () => {
    const r = caip2ToNamespace("sui:devnet");
    assert.deepEqual(r, { namespace: "sui", chainId: 3 });
  });

  it("rejects sui:<unknown-network>", () => {
    assert.equal(caip2ToNamespace("sui:zzznet"), null);
  });
});

describe("caip2ToNamespace — existing namespaces unchanged", () => {
  it("eip155:1 still parses to mainnet", () => {
    assert.deepEqual(caip2ToNamespace("eip155:1"), {
      namespace: "eip155",
      chainId: 1,
    });
  });

  it("solana:101 still parses to its chainId", () => {
    assert.deepEqual(caip2ToNamespace("solana:101"), {
      namespace: "solana",
      chainId: 101,
    });
  });
});

describe("namespaceToCaip2 — round-trip with sui", () => {
  for (const ref of ["mainnet", "testnet", "devnet"] as const) {
    it(`round-trips sui:${ref}`, () => {
      const decoded = caip2ToNamespace(`sui:${ref}`);
      assert.ok(decoded);
      const back = namespaceToCaip2(decoded.namespace, decoded.chainId);
      assert.equal(back, `sui:${ref}`);
    });
  }
});

describe("accountToCaip10 — sui example", () => {
  it("formats sui account string", () => {
    const decoded = caip2ToNamespace("sui:mainnet");
    assert.ok(decoded);
    const caip10 = accountToCaip10(
      decoded.namespace,
      decoded.chainId,
      "0x" + "ab".repeat(32),
    );
    assert.equal(caip10, `sui:mainnet:0x${"ab".repeat(32)}`);
  });
});

// Stellar (docs/stellar-chain-support-spec.md §3.9) — the one namespace
// where the CAIP-2 wire reference ("pubnet") diverges from this app's
// internal `ChainConfig.network` value ("mainnet").
describe("caip2ToNamespace — stellar", () => {
  it("recognises stellar:pubnet", () => {
    const r = caip2ToNamespace("stellar:pubnet");
    assert.deepEqual(r, { namespace: "stellar", chainId: 1 });
  });

  it("recognises stellar:testnet", () => {
    const r = caip2ToNamespace("stellar:testnet");
    assert.deepEqual(r, { namespace: "stellar", chainId: 2 });
  });

  it("rejects stellar:mainnet (internal name, not the CAIP-2 reference)", () => {
    assert.equal(caip2ToNamespace("stellar:mainnet"), null);
  });

  it("rejects stellar:<unknown-network>", () => {
    assert.equal(caip2ToNamespace("stellar:zzznet"), null);
  });
});

describe("namespaceToCaip2 — round-trip with stellar", () => {
  for (const ref of ["pubnet", "testnet"] as const) {
    it(`round-trips stellar:${ref}`, () => {
      const decoded = caip2ToNamespace(`stellar:${ref}`);
      assert.ok(decoded);
      const back = namespaceToCaip2(decoded.namespace, decoded.chainId);
      assert.equal(back, `stellar:${ref}`);
    });
  }
});

describe("accountToCaip10 — stellar example", () => {
  it("formats stellar account string using the pubnet reference", () => {
    const decoded = caip2ToNamespace("stellar:pubnet");
    assert.ok(decoded);
    const caip10 = accountToCaip10(
      decoded.namespace,
      decoded.chainId,
      "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6",
    );
    assert.equal(
      caip10,
      "stellar:pubnet:GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6",
    );
  });
});

describe("stellarNetworkToCaipReference / caipReferenceToStellarNetwork", () => {
  it("translates internal mainnet to CAIP-2 pubnet", () => {
    assert.equal(stellarNetworkToCaipReference("mainnet"), "pubnet");
  });

  it("translates internal testnet to CAIP-2 testnet (no rename)", () => {
    assert.equal(stellarNetworkToCaipReference("testnet"), "testnet");
  });

  it("round-trips pubnet back to internal mainnet", () => {
    assert.equal(caipReferenceToStellarNetwork("pubnet"), "mainnet");
  });

  it("round-trips testnet back to internal testnet", () => {
    assert.equal(caipReferenceToStellarNetwork("testnet"), "testnet");
  });

  it("returns null for an unrecognised reference", () => {
    assert.equal(caipReferenceToStellarNetwork("zzznet"), null);
  });
});

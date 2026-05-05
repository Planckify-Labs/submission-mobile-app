/**
 * Type-level + helper tests for `payloads.ts`. Verifies that the
 * discriminated union narrows correctly per `kind`, helpers behave
 * symmetrically, and bigint fields stay native (no string coercion at
 * the type boundary).
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/sui/payloads.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalizeSuiChain,
  chainToNetwork,
  isSuiNetwork,
  networkToChain,
  type SuiApprovalPayload,
  type SuiChain,
  type SuiDecodedCommand,
  type SuiNetwork,
  type SuiSignTxPayload,
} from "./payloads.ts";

describe("isSuiNetwork", () => {
  it("accepts the three networks", () => {
    for (const n of ["mainnet", "testnet", "devnet"]) {
      assert.equal(isSuiNetwork(n), true);
    }
  });

  it("rejects localnet (must be an explicit RPC override at adapter level)", () => {
    assert.equal(isSuiNetwork("localnet"), false);
  });

  it("rejects unrelated strings and non-strings", () => {
    assert.equal(isSuiNetwork("mainnet-beta"), false);
    assert.equal(isSuiNetwork(""), false);
    assert.equal(isSuiNetwork(null), false);
    assert.equal(isSuiNetwork(123), false);
  });
});

describe("networkToChain / chainToNetwork", () => {
  it("round-trips every network", () => {
    for (const n of ["mainnet", "testnet", "devnet"] as SuiNetwork[]) {
      const chain = networkToChain(n);
      assert.equal(chain, `sui:${n}` as SuiChain);
      assert.equal(chainToNetwork(chain), n);
    }
  });

  it("returns null for non-sui chain", () => {
    assert.equal(chainToNetwork("solana:mainnet"), null);
    assert.equal(chainToNetwork("eip155:1"), null);
  });

  it("returns null for sui: with bogus ref", () => {
    assert.equal(chainToNetwork("sui:zzz"), null);
  });
});

describe("canonicalizeSuiChain", () => {
  it("passes through canonical short forms", () => {
    assert.equal(canonicalizeSuiChain("sui:mainnet"), "sui:mainnet");
    assert.equal(canonicalizeSuiChain("sui:testnet"), "sui:testnet");
    assert.equal(canonicalizeSuiChain("sui:devnet"), "sui:devnet");
  });

  it("throws -32602 on invalid chain id", () => {
    let caught: unknown;
    try {
      canonicalizeSuiChain("sui:zzz");
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof Error);
    assert.equal((caught as Error & { code?: number }).code, -32602);
  });

  it("throws on non-sui prefixes", () => {
    assert.throws(() => canonicalizeSuiChain("solana:mainnet"));
    assert.throws(() => canonicalizeSuiChain("ethereum:1"));
  });
});

describe("SuiApprovalPayload — discriminated union narrows by kind", () => {
  it("narrows connect", () => {
    const p: SuiApprovalPayload = {
      kind: "connect",
      network: "mainnet",
      onlyIfTrusted: true,
    };
    if (p.kind === "connect") {
      assert.equal(p.network, "mainnet");
      assert.equal(p.onlyIfTrusted, true);
    }
  });

  it("narrows signMessage", () => {
    const p: SuiApprovalPayload = {
      kind: "signMessage",
      address: "0xabc",
      message: "aGVsbG8=",
      display: "utf8",
    };
    if (p.kind === "signMessage") {
      assert.equal(p.display, "utf8");
    }
  });

  it("narrows signTransaction with mode flag", () => {
    const p: SuiApprovalPayload = {
      kind: "signTransaction",
      mode: "sign-and-execute",
      address: "0xabc",
      network: "mainnet",
      transaction: "AAA=",
      gasBudget: 100_000n,
    };
    if (p.kind === "signTransaction") {
      assert.equal(p.mode, "sign-and-execute");
      // bigint stays native at this layer
      assert.equal(typeof p.gasBudget, "bigint");
    }
  });

  it("narrows switchNetwork", () => {
    const p: SuiApprovalPayload = {
      kind: "switchNetwork",
      from: "mainnet",
      to: "testnet",
    };
    if (p.kind === "switchNetwork") {
      assert.equal(p.from, "mainnet");
      assert.equal(p.to, "testnet");
    }
  });

  it("narrows signIn (SIWS)", () => {
    const p: SuiApprovalPayload = {
      kind: "signIn",
      domain: "app.example",
      chainId: "mainnet",
      issuedAt: "2026-05-05T00:00:00Z",
    };
    if (p.kind === "signIn") {
      assert.equal(p.domain, "app.example");
    }
  });
});

describe("SuiDecodedCommand — discriminated by kind", () => {
  it("MoveCall carries package/module/function", () => {
    const c: SuiDecodedCommand = {
      kind: "MoveCall",
      package: "0x2",
      module: "coin",
      function: "split",
      argumentCount: 2,
      typeArgumentCount: 1,
    };
    if (c.kind === "MoveCall") {
      assert.equal(c.package, "0x2");
      assert.equal(c.argumentCount, 2);
    }
  });

  it("TransferObjects exposes recipient/object counts", () => {
    const c: SuiDecodedCommand = {
      kind: "TransferObjects",
      recipientArgIndex: 1,
      objectArgCount: 3,
    };
    if (c.kind === "TransferObjects") {
      assert.equal(c.recipientArgIndex, 1);
    }
  });

  it("Publish + Upgrade share modules/dependencies but distinct kinds", () => {
    const pub: SuiDecodedCommand = {
      kind: "Publish",
      modules: 1,
      dependencies: 4,
    };
    const upg: SuiDecodedCommand = {
      kind: "Upgrade",
      modules: 2,
      dependencies: 5,
    };
    assert.equal(pub.kind, "Publish");
    assert.equal(upg.kind, "Upgrade");
  });
});

describe("SuiSignTxPayload — bigint fields are native (not strings)", () => {
  it("gasBudget / gasPrice typed as bigint", () => {
    const p: SuiSignTxPayload = {
      mode: "sign-only",
      address: "0xabc",
      network: "mainnet",
      transaction: "AAA=",
      gasBudget: 5_000_000n,
      gasPrice: 1000n,
    };
    assert.equal(typeof p.gasBudget, "bigint");
    assert.equal(typeof p.gasPrice, "bigint");
  });
});

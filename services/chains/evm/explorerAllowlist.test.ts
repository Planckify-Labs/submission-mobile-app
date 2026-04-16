/**
 * TWV-2026-049 — explorer-host allowlist + chain-string sanitisers.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/chains/evm/explorerAllowlist.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isExplorerAllowed,
  sanitiseChainString,
  sanitiseIconUrl,
  validateBlockExplorerUrls,
} from "./explorerAllowlist.ts";

describe("isExplorerAllowed", () => {
  it("verifies canonical Etherscan on mainnet", () => {
    assert.equal(isExplorerAllowed(1, "https://etherscan.io/tx/0xabc"), true);
  });

  it("verifies a subdomain of an allowed host", () => {
    assert.equal(isExplorerAllowed(1, "https://goerli.etherscan.io/"), true);
  });

  it("rejects a host that is not on the chain's allowlist", () => {
    assert.equal(isExplorerAllowed(1, "https://polygonscan.com/"), false);
  });

  it("rejects http (non-https)", () => {
    assert.equal(isExplorerAllowed(1, "http://etherscan.io/"), false);
  });

  it("rejects an attacker phishing host that shares a prefix", () => {
    assert.equal(
      isExplorerAllowed(1, "https://etherscan.io.phish.test/"),
      false,
    );
  });

  it("rejects a malformed URL", () => {
    assert.equal(isExplorerAllowed(1, "not a url"), false);
  });

  it("returns false for an unknown chainId", () => {
    assert.equal(isExplorerAllowed(99999, "https://etherscan.io/"), false);
  });
});

describe("validateBlockExplorerUrls", () => {
  it("tags each URL verified/unverified", () => {
    const out = validateBlockExplorerUrls(1, [
      "https://etherscan.io/",
      "https://fake.etherscan.io.phish.test/",
      "http://etherscan.io/",
    ]);
    assert.equal(out[0].status, "verified");
    assert.equal(out[1].status, "unverified");
    assert.equal(out[2].status, "unverified");
  });
});

describe("sanitiseChainString", () => {
  it("strips control chars", () => {
    assert.equal(sanitiseChainString("Ether\u0000eum"), "Ethereum");
  });

  it("strips zero-width / bidi characters", () => {
    assert.equal(sanitiseChainString("Eth\u200ber\u202eeum"), "Ethereum");
  });

  it("clips to the max length", () => {
    assert.equal(sanitiseChainString("a".repeat(200), 10), "a".repeat(10));
  });

  it("returns empty string for non-string input", () => {
    assert.equal(sanitiseChainString(undefined), "");
    assert.equal(sanitiseChainString(42 as unknown as string), "");
  });
});

describe("sanitiseIconUrl", () => {
  it("accepts https", () => {
    assert.equal(
      sanitiseIconUrl("https://cdn.example/icon.png"),
      "https://cdn.example/icon.png",
    );
  });

  it("rejects javascript:", () => {
    assert.equal(sanitiseIconUrl("javascript:alert(1)"), null);
  });

  it("rejects data:", () => {
    assert.equal(sanitiseIconUrl("data:image/svg+xml;utf8,<svg/>"), null);
  });

  it("rejects http", () => {
    assert.equal(sanitiseIconUrl("http://cdn.example/icon.png"), null);
  });
});

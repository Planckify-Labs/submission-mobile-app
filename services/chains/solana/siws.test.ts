/**
 * Unit tests for `services/chains/solana/siws.ts`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/solana/siws.test.ts
 *
 * Vectors derived from `phantom/sign-in-with-solana` reference.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSiwsMessage, parseSiwsMessage } from "./siws.ts";

describe("buildSiwsMessage", () => {
  it("minimal input — domain + address only", () => {
    const msg = buildSiwsMessage({
      domain: "phantom.app",
      address: "9xyz123",
    });
    assert.equal(
      msg,
      "phantom.app wants you to sign in with your Solana account:\n9xyz123",
    );
  });

  it("full input — every optional field", () => {
    const msg = buildSiwsMessage({
      domain: "example.com",
      address: "9xyz123",
      statement: "I accept the terms.",
      uri: "https://example.com/login",
      version: "1",
      chainId: "mainnet-beta",
      nonce: "abc123",
      issuedAt: "2026-01-01T00:00:00Z",
      expirationTime: "2026-01-02T00:00:00Z",
      notBefore: "2026-01-01T00:00:00Z",
      requestId: "req-42",
    });
    const expected = [
      "example.com wants you to sign in with your Solana account:",
      "9xyz123",
      "",
      "I accept the terms.",
      "",
      "URI: https://example.com/login",
      "Version: 1",
      "Chain ID: mainnet-beta",
      "Nonce: abc123",
      "Issued At: 2026-01-01T00:00:00Z",
      "Expiration Time: 2026-01-02T00:00:00Z",
      "Not Before: 2026-01-01T00:00:00Z",
      "Request ID: req-42",
    ].join("\n");
    assert.equal(msg, expected);
  });

  it("resources block with multiple entries", () => {
    const msg = buildSiwsMessage({
      domain: "drift.trade",
      address: "9xyz123",
      resources: [
        "ipfs://bafybei",
        "https://example.com/terms",
      ],
    });
    const expected = [
      "drift.trade wants you to sign in with your Solana account:",
      "9xyz123",
      "",
      "Resources:",
      "- ipfs://bafybei",
      "- https://example.com/terms",
    ].join("\n");
    assert.equal(msg, expected);
  });

  it("omits undefined fields (never invents values)", () => {
    const msg = buildSiwsMessage({
      domain: "foo.xyz",
      address: "9xyz123",
      uri: "https://foo.xyz",
    });
    // Only URI should be rendered — no Version/Chain ID/etc.
    assert.ok(msg.includes("URI: https://foo.xyz"));
    assert.ok(!msg.includes("Version:"));
    assert.ok(!msg.includes("Nonce:"));
  });

  it("rejects expirationTime ≤ issuedAt with -32602", () => {
    try {
      buildSiwsMessage({
        domain: "foo.xyz",
        address: "9xyz123",
        issuedAt: "2026-01-02T00:00:00Z",
        expirationTime: "2026-01-01T00:00:00Z",
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.equal((err as Error & { code?: number }).code, -32602);
    }
  });

  it("rejects CR characters in any field", () => {
    assert.throws(() =>
      buildSiwsMessage({
        domain: "foo.xyz\r",
        address: "9xyz123",
      }),
    );
    assert.throws(() =>
      buildSiwsMessage({
        domain: "foo.xyz",
        address: "9xyz123",
        statement: "hello\r\nworld",
        uri: "https://foo.xyz\rxxx",
      }),
    );
  });
});

describe("parseSiwsMessage round-trip", () => {
  it("parse(build(x)) recovers the structured input", () => {
    const input = {
      domain: "example.com",
      address: "9xyz123",
      statement: "I accept the terms.",
      uri: "https://example.com/login",
      version: "1" as const,
      chainId: "mainnet-beta" as const,
      nonce: "abc123",
      issuedAt: "2026-01-01T00:00:00Z",
      expirationTime: "2026-01-02T00:00:00Z",
      notBefore: "2026-01-01T00:00:00Z",
      requestId: "req-42",
      resources: ["ipfs://a", "ipfs://b"],
    };
    const built = buildSiwsMessage(input);
    const parsed = parseSiwsMessage(built);
    assert.equal(parsed.domain, input.domain);
    assert.equal(parsed.address, input.address);
    assert.equal(parsed.uri, input.uri);
    assert.equal(parsed.nonce, input.nonce);
    assert.deepEqual(parsed.resources, input.resources);
  });

  it("rejects malformed message header", () => {
    assert.throws(() => parseSiwsMessage(""));
    assert.throws(() => parseSiwsMessage("not a SIWS message\n9xyz"));
  });
});

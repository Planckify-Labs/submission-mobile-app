/**
 * Unit tests for `checkVanityPrefixRisk` — TWV-2026-040.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/vanityPrefix.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkVanityPrefixRisk } from "./vanityPrefix.ts";

describe("checkVanityPrefixRisk — profanity-class heuristic", () => {
  it("flags an address with 7 leading zero nibbles", () => {
    const addr = "0x0000000" + "a".repeat(33);
    const result = checkVanityPrefixRisk(addr);
    assert.equal(result.flagged, true);
    assert.equal(result.reason, "profanity-long-leading-zeros");
    assert.ok(result.description);
  });

  it("flags an address with 8 leading zero nibbles (Wintermute-class)", () => {
    // Wintermute's hot wallet had 4 leading zero bytes (8 hex zeros).
    const addr = "0x00000000" + "deadbeef".repeat(4);
    const result = checkVanityPrefixRisk(addr);
    assert.equal(result.flagged, true);
    assert.equal(result.reason, "profanity-long-leading-zeros");
  });

  it("flags an address with 7 trailing zero nibbles", () => {
    const addr = "0x" + "a".repeat(33) + "0000000";
    const result = checkVanityPrefixRisk(addr);
    assert.equal(result.flagged, true);
    assert.equal(result.reason, "profanity-long-trailing-zeros");
  });

  it("does NOT flag an address with only 6 leading zero nibbles", () => {
    const addr = "0x000000" + "a".repeat(34);
    const result = checkVanityPrefixRisk(addr);
    assert.equal(result.flagged, false);
  });

  it("does NOT flag a benign checksum-case address", () => {
    // Vitalik's well-known address.
    const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    const result = checkVanityPrefixRisk(addr);
    assert.equal(result.flagged, false);
  });

  it("is case-insensitive", () => {
    const addr = "0X00000000" + "DEADBEEF".repeat(4);
    const result = checkVanityPrefixRisk(addr);
    assert.equal(result.flagged, true);
  });

  it("rejects non-EVM-shaped strings as `flagged: false`", () => {
    assert.equal(checkVanityPrefixRisk(undefined).flagged, false);
    assert.equal(checkVanityPrefixRisk(null).flagged, false);
    assert.equal(checkVanityPrefixRisk("").flagged, false);
    assert.equal(checkVanityPrefixRisk("not-an-address").flagged, false);
    // Solana-shape (base58) addresses aren't EVM; heuristic doesn't apply.
    assert.equal(
      checkVanityPrefixRisk("Ez4iPSUQYe2m8hwkJ9Y5mVHmKz6zqfJy6V3Gd4xKpBa2")
        .flagged,
      false,
    );
  });
});

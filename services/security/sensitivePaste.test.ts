/**
 * Unit tests for sensitive-paste detection — TWV-2026-063.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/sensitivePaste.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { looksLikeBip39, tokenizeMnemonicCandidate } from "./sensitivePaste.ts";

describe("looksLikeBip39", () => {
  it("flags a valid 12-word BIP-39 mnemonic", () => {
    // BIP-39 test vector — all words in-wordlist, length 12.
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon " +
      "abandon abandon abandon abandon abandon about";
    assert.equal(looksLikeBip39(mnemonic), true);
  });

  it("flags a valid 24-word BIP-39 mnemonic", () => {
    const mnemonic = Array.from({ length: 23 })
      .fill("abandon")
      .concat("art")
      .join(" ");
    assert.equal(looksLikeBip39(mnemonic), true);
  });

  it("flags 15, 18, 21 word lengths when all tokens are in-wordlist", () => {
    for (const n of [15, 18, 21]) {
      const mnemonic = Array.from({ length: n }).fill("abandon").join(" ");
      assert.equal(
        looksLikeBip39(mnemonic),
        true,
        `expected ${n}-word mnemonic to be flagged`,
      );
    }
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    const mnemonic =
      "  Abandon  abandon\tabandon\nabandon ABANDON abandon " +
      "abandon abandon abandon abandon abandon about ";
    assert.equal(looksLikeBip39(mnemonic), true);
  });

  it("does not flag a 13-word string (invalid BIP-39 length)", () => {
    const mnemonic = Array.from({ length: 13 }).fill("abandon").join(" ");
    assert.equal(looksLikeBip39(mnemonic), false);
  });

  it("does not flag when any token is off-wordlist", () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon " +
      "abandon abandon abandon abandon abandon notaword";
    assert.equal(looksLikeBip39(mnemonic), false);
  });

  it("does not flag an empty or blank string", () => {
    assert.equal(looksLikeBip39(""), false);
    assert.equal(looksLikeBip39("   \n  "), false);
  });

  it("does not flag a private-key hex string", () => {
    const pk =
      "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
    assert.equal(looksLikeBip39(pk), false);
  });

  it("does not flag a prose sentence that mostly misses the wordlist", () => {
    // Intentionally uses common English words that are NOT in the
    // BIP-39 english list (`the`, `quick`, `jumped`, `over`, `very`,
    // `sleeping`, `small`).
    const prose =
      "the quick brown fox jumped over the very lazy sleeping small dog";
    assert.equal(looksLikeBip39(prose), false);
  });
});

describe("tokenizeMnemonicCandidate", () => {
  it("lowercases and splits on any whitespace run", () => {
    assert.deepEqual(tokenizeMnemonicCandidate("  Foo\tbAr\nBaz  "), [
      "foo",
      "bar",
      "baz",
    ]);
  });

  it("returns empty array for blank input", () => {
    assert.deepEqual(tokenizeMnemonicCandidate(""), []);
    assert.deepEqual(tokenizeMnemonicCandidate("   \t \n"), []);
  });
});

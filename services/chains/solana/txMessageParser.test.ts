/**
 * Unit tests for `txMessageParser`. Builds small wire-format fixtures
 * by hand (no @solana/kit dep) and asserts the parser recovers the
 * structural fields the inspector + agent need.
 *
 * Run:
 *   node --test --experimental-strip-types services/chains/solana/txMessageParser.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseWireTransaction,
  signerAccounts,
  writableAccounts,
} from "./txMessageParser.ts";

function compactU16(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n & 0x7f);
  if (out.length === 0) return [0];
  return out;
}

function b64(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64");
}

function key(n: number): number[] {
  // Build a 32-byte key stamped with `n` so `bytesToBase58` differs
  // between keys. Keep all bytes > 0 so the encoder doesn't emit
  // leading "1"s we'd have to account for.
  const bytes = new Array(32).fill(1);
  bytes[31] = n;
  return bytes;
}

describe("parseWireTransaction — legacy", () => {
  it("recovers header + 2 keys + 1 System transfer instruction", () => {
    // 1 signature block — exactly 64 bytes.
    const sigCount = compactU16(1);
    const sigBlock = new Array(64).fill(0);
    // Message header: legacy (first byte < 0x80).
    const header = [1, 0, 0];
    const keyCount = compactU16(2);
    const key0 = key(10);
    const key1 = key(20);
    const blockhash = new Array(32).fill(7);
    const ixCount = compactU16(1);
    const ix = [
      1, // programIdIndex → key1
      ...compactU16(1), // account count
      0, // accounts[0] = key0
      ...compactU16(0), // data len = 0
    ];
    const bytes = [
      ...sigCount,
      ...sigBlock,
      ...header,
      ...keyCount,
      ...key0,
      ...key1,
      ...blockhash,
      ...ixCount,
      ...ix,
    ];
    const parsed = parseWireTransaction(b64(bytes));
    assert.ok(parsed);
    assert.equal(parsed.version, "legacy");
    assert.equal(parsed.numRequiredSignatures, 1);
    assert.equal(parsed.accountKeys.length, 2);
    assert.equal(parsed.feePayer, parsed.accountKeys[0]);
    assert.equal(parsed.instructions.length, 1);
    assert.equal(parsed.instructions[0].programId, parsed.accountKeys[1]);
    assert.equal(parsed.instructions[0].accounts.length, 1);
  });
});

describe("parseWireTransaction — v0", () => {
  it("detects version 0 and parses empty ALT list", () => {
    const signatures = [0]; // compact-u16 = 0 signatures
    // v0 — first byte has high bit set (0x80), then 3-byte header.
    const header = [0x80, 1, 0, 0];
    const keyCount = compactU16(1);
    const key0 = key(42);
    const blockhash = new Array(32).fill(9);
    const ixCount = compactU16(0);
    const altCount = compactU16(0);
    const bytes = [
      ...signatures,
      ...header,
      ...keyCount,
      ...key0,
      ...blockhash,
      ...ixCount,
      ...altCount,
    ];
    const parsed = parseWireTransaction(b64(bytes));
    assert.ok(parsed);
    assert.equal(parsed.version, 0);
    assert.equal(parsed.numRequiredSignatures, 1);
    assert.equal(parsed.addressTableLookups.length, 0);
  });
});

describe("writable / signer helpers", () => {
  it("writableAccounts splits signer+nonsigner writable slots correctly", () => {
    const t = {
      version: "legacy" as const,
      numRequiredSignatures: 2,
      numReadonlySigned: 1,
      numReadonlyUnsigned: 1,
      feePayer: "A",
      accountKeys: ["A", "B", "C", "D"],
      recentBlockhash: "blk",
      instructions: [],
      addressTableLookups: [],
    };
    const w = writableAccounts(t);
    // signerWritableEnd = 2 - 1 = 1 → key 0 (A) only
    // nonSignerWritableEnd = 4 - 1 = 3 → keys [numRequiredSignatures=2, 3) → key 2 (C)
    assert.deepEqual(w, ["A", "C"]);
    assert.deepEqual(signerAccounts(t), ["A", "B"]);
  });
});

describe("parseWireTransaction — rejects malformed input", () => {
  it("returns null for non-base64 garbage", () => {
    // A string that's too short / malformed.
    assert.equal(parseWireTransaction("!!!"), null);
  });
  it("returns null when sig count overshoots buffer", () => {
    // Claim 10 signatures but buffer is empty.
    const bytes = [10];
    assert.equal(parseWireTransaction(b64(bytes)), null);
  });
});

/**
 * Unit tests for `services/chains/solana/codec.ts`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/solana/codec.test.ts
 *
 * Node-only — no react / react-native / viem imports.
 *
 * Rules (task 08):
 *   - No `console.log` on `Uint8Array` arguments (secret material).
 *   - Tests must not hit the network; transaction round-trip uses a
 *     hand-built minimal wire-format fixture, not a live devnet blob.
 */

import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { describe, it } from "node:test";

import {
  base58ToBytes,
  base64ToTransaction,
  bytesToBase58,
  parseSolanaPrivateKey,
  transactionToBase64,
} from "./codec.ts";

// `@solana/kit` reaches for `globalThis.crypto` at import time for a few
// code paths. Node 22 exposes `node:crypto`'s `webcrypto` which is
// compatible enough for our encode/decode-only tests. No polyfills,
// no key generation here.
if (!globalThis.crypto) {
  (globalThis as { crypto: typeof webcrypto }).crypto = webcrypto;
}

/**
 * Build a minimal legacy Solana wire transaction by hand.
 *
 * Layout (compact-u16 prefixed arrays):
 *   signatures: [1-count, 64 zero bytes]
 *   message:
 *     header: [numRequiredSignatures=1, numReadonlySigned=0, numReadonlyUnsigned=0]
 *     accountKeys: [1-count, 32-byte pubkey]
 *     recentBlockhash: 32 bytes
 *     instructions: [0-count]
 *
 * Total = 1 + 64 + 3 + 1 + 32 + 32 + 1 = 134 bytes.
 *
 * We fill the pubkey / blockhash with distinct byte patterns so any
 * off-by-one in the codec surfaces as a byte-level mismatch.
 */
function buildMinimalWireTransactionBytes(): Uint8Array {
  const bytes = new Uint8Array(1 + 64 + 3 + 1 + 32 + 32 + 1);
  let o = 0;
  bytes[o++] = 1; // compact-u16 signature count
  for (let i = 0; i < 64; i++) bytes[o++] = 0; // zero signature
  bytes[o++] = 1; // header: required signatures
  bytes[o++] = 0;
  bytes[o++] = 0;
  bytes[o++] = 1; // account-keys compact count
  for (let i = 0; i < 32; i++) bytes[o++] = i + 1; // pubkey pattern
  for (let i = 0; i < 32; i++) bytes[o++] = 2; // blockhash pattern
  bytes[o++] = 0; // zero instructions
  return bytes;
}

function bytesToBase64(b: Uint8Array): string {
  // Node-only helper used purely for fixture construction. The production
  // path does NOT rely on Buffer — callers use `transactionToBase64`.
  return Buffer.from(b).toString("base64");
}

describe("base58 <-> bytes round-trip", () => {
  it("bytesToBase58(base58ToBytes(x)) === x for a known fixture (32 zero bytes)", () => {
    // "11111111111111111111111111111111" is the canonical base58 encoding
    // of 32 zero bytes (Solana's System Program address).
    const fixture = "11111111111111111111111111111111";
    const decoded = base58ToBytes(fixture);
    assert.equal(decoded.length, 32);
    for (const byte of decoded) assert.equal(byte, 0);
    assert.equal(bytesToBase58(decoded), fixture);
  });

  it("round-trips a non-trivial 32-byte buffer", () => {
    const src = new Uint8Array(32);
    for (let i = 0; i < 32; i++) src[i] = (i * 7 + 3) & 0xff;
    const encoded = bytesToBase58(src);
    const decoded = base58ToBytes(encoded);
    assert.equal(decoded.length, 32);
    for (let i = 0; i < 32; i++) assert.equal(decoded[i], src[i]);
  });

  it("round-trips a 64-byte buffer (Phantom secret-key size)", () => {
    const src = new Uint8Array(64);
    for (let i = 0; i < 64; i++) src[i] = (i * 13 + 5) & 0xff;
    const decoded = base58ToBytes(bytesToBase58(src));
    assert.equal(decoded.length, 64);
    for (let i = 0; i < 64; i++) assert.equal(decoded[i], src[i]);
  });
});

describe("parseSolanaPrivateKey", () => {
  it("accepts a 32-byte seed and returns exactly those 32 bytes", () => {
    const seed = new Uint8Array(32);
    for (let i = 0; i < 32; i++) seed[i] = (i * 11 + 1) & 0xff;
    const seedB58 = bytesToBase58(seed);
    const parsed = parseSolanaPrivateKey(seedB58);
    assert.equal(parsed.length, 32);
    for (let i = 0; i < 32; i++) assert.equal(parsed[i], seed[i]);
  });

  it("accepts a 64-byte Phantom export and returns the first 32 bytes (seed half)", () => {
    const full = new Uint8Array(64);
    for (let i = 0; i < 32; i++) full[i] = (i * 17 + 2) & 0xff; // seed half
    for (let i = 32; i < 64; i++) full[i] = 0xaa; // pubkey half (sentinel)
    const parsed = parseSolanaPrivateKey(bytesToBase58(full));
    assert.equal(parsed.length, 32);
    for (let i = 0; i < 32; i++) assert.equal(parsed[i], full[i]);
    // Crucially, the sentinel pubkey bytes must NOT appear in the output.
    for (const byte of parsed) assert.notEqual(byte, 0xaa);
  });

  it("throws on an unexpected length", () => {
    const garbage = new Uint8Array(16);
    for (let i = 0; i < 16; i++) garbage[i] = i + 1;
    assert.throws(
      () => parseSolanaPrivateKey(bytesToBase58(garbage)),
      /Invalid Solana private key length/,
    );
  });
});

describe("base64 <-> Transaction round-trip", () => {
  it("decodes and re-encodes a minimal wire-format transaction", () => {
    const fixtureBytes = buildMinimalWireTransactionBytes();
    const fixtureB64 = bytesToBase64(fixtureBytes);

    const tx = base64ToTransaction(fixtureB64);
    // Sanity: the decoder populated signatures and messageBytes.
    assert.equal(Object.keys(tx.signatures).length, 1);
    assert.ok(tx.messageBytes.length > 0);

    const roundTripped = transactionToBase64(tx);
    assert.equal(roundTripped, fixtureB64);
  });
});

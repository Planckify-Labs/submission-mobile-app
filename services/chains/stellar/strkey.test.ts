/**
 * Boundary tests for the Stellar StrKey wrapper.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §9 (test table row 2).
 */

import { describe, expect, it } from "vitest";

import {
  decodeStellarSecretSeed,
  encodeStellarSecretSeed,
  InvalidStellarSecretSeedEncodingError,
  isValidStellarAddress,
  isValidStellarSecretSeed,
} from "./strkey.ts";

// Real StrKey vectors generated via `@stellar/stellar-base` — not
// hand-crafted strings — so the checksum bytes are genuinely valid.
const VALID_ADDRESS =
  "GBOSZQGJAS2HCVOOG2N7GRSOYWC7YQP4RGJNV454NURGWRV7SVSAFHX2";
const VALID_SECRET = "SBAPVOBWDYMUK3EZD2RDVN2WTVOU3TBJWVW5H4K2OCYQ5JNTT6C36WPZ";
const MUXED_ACCOUNT =
  "MBOSZQGJAS2HCVOOG2N7GRSOYWC7YQP4RGJNV454NURGWRV7SVSAEAAAAAAAAAAAAA6LA";
const CONTRACT_ADDRESS =
  "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";

describe("isValidStellarAddress", () => {
  it("accepts a canonical G… address", () => {
    expect(isValidStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it("rejects a bad checksum", () => {
    const lastChar = VALID_ADDRESS.slice(-1);
    const flipped = lastChar === "A" ? "B" : "A";
    const corrupted = `${VALID_ADDRESS.slice(0, -1)}${flipped}`;
    expect(isValidStellarAddress(corrupted)).toBe(false);
  });

  it("rejects a muxed M… address (out of scope, §0)", () => {
    expect(isValidStellarAddress(MUXED_ACCOUNT)).toBe(false);
  });

  it("rejects a Soroban contract C… address (out of scope, §0)", () => {
    expect(isValidStellarAddress(CONTRACT_ADDRESS)).toBe(false);
  });

  it("rejects a secret seed passed as an address", () => {
    expect(isValidStellarAddress(VALID_SECRET)).toBe(false);
  });

  it("rejects empty / garbage input without throwing", () => {
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress("not-a-strkey")).toBe(false);
  });
});

describe("isValidStellarSecretSeed", () => {
  it("accepts a canonical S… secret seed", () => {
    expect(isValidStellarSecretSeed(VALID_SECRET)).toBe(true);
  });

  it("rejects a public address passed as a secret", () => {
    expect(isValidStellarSecretSeed(VALID_ADDRESS)).toBe(false);
  });

  it("rejects a bad checksum", () => {
    const lastChar = VALID_SECRET.slice(-1);
    const flipped = lastChar === "A" ? "B" : "A";
    const corrupted = `${VALID_SECRET.slice(0, -1)}${flipped}`;
    expect(isValidStellarSecretSeed(corrupted)).toBe(false);
  });

  it("rejects empty / garbage input without throwing", () => {
    expect(isValidStellarSecretSeed("")).toBe(false);
    expect(isValidStellarSecretSeed("not-a-strkey")).toBe(false);
  });
});

describe("decodeStellarSecretSeed / encodeStellarSecretSeed", () => {
  it("decodes to a 32-byte payload", () => {
    const raw = decodeStellarSecretSeed(VALID_SECRET);
    expect(raw.length).toBe(32);
  });

  it("round-trips through encode", () => {
    const raw = decodeStellarSecretSeed(VALID_SECRET);
    expect(encodeStellarSecretSeed(raw)).toBe(VALID_SECRET);
  });

  it("throws InvalidStellarSecretSeedEncodingError on malformed input", () => {
    expect(() => decodeStellarSecretSeed("garbage")).toThrow(
      InvalidStellarSecretSeedEncodingError,
    );
  });

  it("throws InvalidStellarSecretSeedEncodingError when given a G… address", () => {
    expect(() => decodeStellarSecretSeed(VALID_ADDRESS)).toThrow(
      InvalidStellarSecretSeedEncodingError,
    );
  });
});

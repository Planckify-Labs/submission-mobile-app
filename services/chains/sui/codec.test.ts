/**
 * Unit tests for `services/chains/sui/codec.ts`.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §1.4, §1.5, §3.2.
 *
 * Style mirrors `services/chains/solana/codec.test.ts`. Vitest is the
 * harness already wired into the repo (see `vitest.config.ts`).
 *
 * Rules (Task 13):
 *   - No `console.log` of `Uint8Array` arguments — secret material.
 *   - No network. All fixtures are deterministic / locally derived.
 */

import { fromBase64, toBase64 } from "@mysten/bcs";
import { messageWithIntent } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { describe, expect, it } from "vitest";

import {
  decodeSuiPrivateKey,
  deriveSuiAddressFromPubkey,
  encodeSuiPrivateKey,
  InvalidSuiPrivateKeyEncodingError,
  messageWithSuiIntent,
} from "./codec.ts";

// BIP-39 canonical zero mnemonic — already used by `derivation.test.ts`.
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const SUI_DEFAULT_PATH = "m/44'/784'/0'/0'/0'";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

describe("decodeSuiPrivateKey + encodeSuiPrivateKey (bech32 round-trip)", () => {
  it("round-trips a canonical SDK-derived bech32 secret key byte-equal", () => {
    const keypair = Ed25519Keypair.deriveKeypair(
      TEST_MNEMONIC,
      SUI_DEFAULT_PATH,
    );
    const bech32 = keypair.getSecretKey();
    expect(bech32.startsWith("suiprivkey1")).toBe(true);

    const seed = decodeSuiPrivateKey(bech32);
    expect(seed.length).toBe(32);

    const reEncoded = encodeSuiPrivateKey(seed);
    expect(reEncoded).toBe(bech32);

    // And re-decoding the re-encoded form yields a byte-equal seed.
    const seed2 = decodeSuiPrivateKey(reEncoded);
    expect(bytesEqual(seed, seed2)).toBe(true);
  });
});

describe("decodeSuiPrivateKey (hex form)", () => {
  it("accepts `0x` + 64 zero hex chars and returns 32 zero bytes", () => {
    const seed = decodeSuiPrivateKey(`0x${"0".repeat(64)}`);
    expect(seed.length).toBe(32);
    for (const byte of seed) expect(byte).toBe(0);
  });

  it("accepts bare 64-hex (no `0x` prefix)", () => {
    const seed = decodeSuiPrivateKey("0".repeat(64));
    expect(seed.length).toBe(32);
    for (const byte of seed) expect(byte).toBe(0);
  });

  it("accepts mixed-case hex and reproduces the exact byte pattern", () => {
    // Build a non-trivial 32-byte pattern, hex it, then decode and compare.
    const src = new Uint8Array(32);
    for (let i = 0; i < 32; i++) src[i] = (i * 7 + 3) & 0xff;
    const hex = Array.from(src, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    const decoded = decodeSuiPrivateKey(`0x${hex.toUpperCase()}`);
    expect(bytesEqual(decoded, src)).toBe(true);
  });
});

describe("decodeSuiPrivateKey (base64 form)", () => {
  it("decodes a 32-byte base64 payload byte-equal to the source", () => {
    const src = new Uint8Array(32);
    for (let i = 0; i < 32; i++) src[i] = (i * 13 + 5) & 0xff;
    const b64 = toBase64(src);
    const decoded = decodeSuiPrivateKey(b64);
    expect(decoded.length).toBe(32);
    expect(bytesEqual(decoded, src)).toBe(true);
    // Sanity: same value produced via fromBase64 directly.
    expect(bytesEqual(decoded, fromBase64(b64))).toBe(true);
  });
});

describe("decodeSuiPrivateKey (invalid inputs)", () => {
  it("throws InvalidSuiPrivateKeyEncodingError on empty string", () => {
    expect(() => decodeSuiPrivateKey("")).toThrow(
      InvalidSuiPrivateKeyEncodingError,
    );
  });

  it("throws InvalidSuiPrivateKeyEncodingError on a 31-byte base64 payload", () => {
    const tooShort = new Uint8Array(31);
    for (let i = 0; i < 31; i++) tooShort[i] = i;
    expect(() => decodeSuiPrivateKey(toBase64(tooShort))).toThrow(
      InvalidSuiPrivateKeyEncodingError,
    );
  });

  it("throws InvalidSuiPrivateKeyEncodingError on non-hex / non-base64 garbage", () => {
    // Contains characters outside both hex and base64 alphabets ('!', '?').
    expect(() => decodeSuiPrivateKey("!!! definitely not a key ???")).toThrow(
      InvalidSuiPrivateKeyEncodingError,
    );
  });

  it("throws InvalidSuiPrivateKeyEncodingError on malformed bech32 (correct prefix, bad checksum)", () => {
    // Prefix triggers the bech32 branch; payload is intentionally invalid.
    expect(() =>
      decodeSuiPrivateKey("suiprivkey1qqqqqqqqqqqqqqqqqqqqqqqqqqqq"),
    ).toThrow(InvalidSuiPrivateKeyEncodingError);
  });
});

describe("encodeSuiPrivateKey (length guard)", () => {
  it("throws InvalidSuiPrivateKeyEncodingError for a non-32-byte seed", () => {
    expect(() => encodeSuiPrivateKey(new Uint8Array(16))).toThrow(
      InvalidSuiPrivateKeyEncodingError,
    );
  });
});

describe("deriveSuiAddressFromPubkey", () => {
  it("matches keypair.toSuiAddress() for the same Ed25519 public key", () => {
    const keypair = Ed25519Keypair.deriveKeypair(
      TEST_MNEMONIC,
      SUI_DEFAULT_PATH,
    );
    const pubkey = keypair.getPublicKey().toRawBytes();
    const addressFromCodec = deriveSuiAddressFromPubkey(pubkey);
    const addressFromKeypair = keypair.toSuiAddress();
    expect(addressFromCodec).toBe(addressFromKeypair);
    expect(addressFromCodec).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("messageWithSuiIntent", () => {
  it("personal scope is byte-equal to the SDK's messageWithIntent('PersonalMessage', ...)", () => {
    const msg = new TextEncoder().encode("hello sui");
    const ours = messageWithSuiIntent("personal", msg);
    const sdk = messageWithIntent("PersonalMessage", msg);
    expect(bytesEqual(ours, sdk)).toBe(true);
  });

  it("transaction scope is byte-equal to the SDK's messageWithIntent('TransactionData', ...)", () => {
    const txBytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) txBytes[i] = (i * 3 + 1) & 0xff;
    const ours = messageWithSuiIntent("transaction", txBytes);
    const sdk = messageWithIntent("TransactionData", txBytes);
    expect(bytesEqual(ours, sdk)).toBe(true);
  });
});

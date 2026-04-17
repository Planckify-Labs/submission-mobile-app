/**
 * Unit tests for the Solana additions in `utils/walletUtils.ts`.
 *
 * Spec reference: `docs/solana-chain-support-spec.md` §7.3, §14.6.
 * Task reference: `docs/solana-chain-support-task/09_solana_wallet_creators_and_validators_istaken_true.md`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *        --import ./utils/_test-resolver.mjs \
 *        utils/walletUtils.test.ts
 *
 * Node-only — no react / react-native / expo imports at the test bench.
 * `_test-resolver.mjs` aliases `@/*` and stubs the expo modules reached
 * through transitive imports.
 */

import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { describe, it } from "node:test";

// `@solana/kit` reaches for `globalThis.crypto` at import time. Node 22
// exposes `node:crypto`'s `webcrypto`, which supports Ed25519 natively
// (so no polyfill is required in this test bench).
if (!globalThis.crypto) {
  (globalThis as { crypto: typeof webcrypto }).crypto = webcrypto;
}

import { bytesToBase58 } from "@/services/chains/solana/codec";
import {
  createSolanaWalletFromMnemonic,
  createSolanaWalletFromPrivateKey,
  isValidSolanaAddress,
  isValidSolanaPrivateKey,
  parseSolanaPrivateKey,
} from "@/utils/walletUtils";

// Canonical Phantom-verified golden vector from
// `services/chains/solana/derivation.test.ts`.
const GOLDEN_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const GOLDEN_ADDRESS = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk";

// System-Program address = 32 zero bytes, base58-encoded. A known-good
// 32-byte Solana address fixture.
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";

// A 64-hex EVM-style key. Under the §14.6 cross-curve guard this must
// NEVER validate as a Solana private key. The hex characters that aren't
// also base58 (0, O, I, l) mean decoding this as base58 either throws
// or yields a byte length ≠ 32/64 — either outcome is a rejection.
const EVM_HEX_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("isValidSolanaAddress", () => {
  it("accepts a known 32-byte base58 Solana address (System Program)", () => {
    assert.equal(isValidSolanaAddress(SYSTEM_PROGRAM_ADDRESS), true);
  });

  it("accepts the golden-vector derived address", () => {
    assert.equal(isValidSolanaAddress(GOLDEN_ADDRESS), true);
  });

  it("rejects a random short string", () => {
    assert.equal(isValidSolanaAddress("abc"), false);
  });

  it("rejects an empty string", () => {
    assert.equal(isValidSolanaAddress(""), false);
  });

  it("rejects an EVM 0x-hex string (wrong length after base58 decode)", () => {
    assert.equal(
      isValidSolanaAddress("0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97"),
      false,
    );
  });

  it("never throws on obviously malformed input", () => {
    // `I`, `O`, `0`, `l` are non-base58; bs58 throws — the validator must
    // swallow that and return false.
    assert.doesNotThrow(() => isValidSolanaAddress("Il0O"));
    assert.equal(isValidSolanaAddress("Il0O"), false);
  });
});

describe("isValidSolanaPrivateKey", () => {
  it("accepts a 32-byte Solana seed (base58)", () => {
    const seed = new Uint8Array(32);
    for (let i = 0; i < 32; i++) seed[i] = (i * 7 + 1) & 0xff;
    assert.equal(isValidSolanaPrivateKey(bytesToBase58(seed)), true);
  });

  it("accepts a Phantom 64-byte export (base58)", () => {
    const full = new Uint8Array(64);
    for (let i = 0; i < 64; i++) full[i] = (i * 13 + 3) & 0xff;
    assert.equal(isValidSolanaPrivateKey(bytesToBase58(full)), true);
  });

  it("rejects an EVM 64-char hex key (§14.6 cross-curve guard)", () => {
    assert.equal(isValidSolanaPrivateKey(EVM_HEX_KEY), false);
    // Also reject the unprefixed form.
    assert.equal(isValidSolanaPrivateKey(EVM_HEX_KEY.slice(2)), false);
  });

  it("rejects empty and obviously garbage input without throwing", () => {
    assert.equal(isValidSolanaPrivateKey(""), false);
    assert.doesNotThrow(() => isValidSolanaPrivateKey("not-a-key"));
  });
});

describe("parseSolanaPrivateKey (walletUtils non-throwing wrapper)", () => {
  it("returns the 32-byte seed for a 32-byte base58 input", () => {
    const seed = new Uint8Array(32);
    for (let i = 0; i < 32; i++) seed[i] = (i * 11 + 2) & 0xff;
    const parsed = parseSolanaPrivateKey(bytesToBase58(seed));
    assert.ok(parsed instanceof Uint8Array);
    assert.equal(parsed!.length, 32);
    for (let i = 0; i < 32; i++) assert.equal(parsed![i], seed[i]);
  });

  it("returns null on malformed input instead of throwing", () => {
    assert.equal(parseSolanaPrivateKey(""), null);
    assert.equal(parseSolanaPrivateKey("not-a-valid-base58"), null);
    assert.equal(parseSolanaPrivateKey(EVM_HEX_KEY), null);
  });
});

describe("createSolanaWalletFromMnemonic", () => {
  it("derives the Phantom-verified golden address", async () => {
    const wallet = await createSolanaWalletFromMnemonic(GOLDEN_MNEMONIC);
    assert.ok(wallet, "expected a TWallet, got null");
    assert.equal(wallet!.address, GOLDEN_ADDRESS);
    assert.equal(wallet!.namespace, "solana");
    assert.equal(wallet!.type, "SeedPhrase");
    assert.equal(wallet!.source, "Created");
    assert.equal(wallet!.solana?.pubkeyBase58, GOLDEN_ADDRESS);
    assert.equal(wallet!.solana?.derivationPath, "m/44'/501'/0'/0'");
    assert.equal(wallet!.seedPhrase, GOLDEN_MNEMONIC);
    // privateKey stored as base58 of the 32-byte seed (Phantom-compat).
    assert.equal(typeof wallet!.privateKey, "string");
  });

  it("returns null for an invalid mnemonic (word-count check)", async () => {
    const result = await createSolanaWalletFromMnemonic("too few words");
    assert.equal(result, null);
  });

  it("honors the optional wallet name", async () => {
    const wallet = await createSolanaWalletFromMnemonic(
      GOLDEN_MNEMONIC,
      "My SOL",
    );
    assert.equal(wallet?.name, "My SOL");
  });
});

describe("createSolanaWalletFromPrivateKey (round-trip)", () => {
  it("round-trips via bytesToBase58(seed) → re-import → same address", async () => {
    const first = await createSolanaWalletFromMnemonic(GOLDEN_MNEMONIC);
    assert.ok(first);
    // The mnemonic-created wallet stores the 32-byte seed as base58 on
    // `privateKey`. Re-importing via `createSolanaWalletFromPrivateKey`
    // must produce the identical address.
    const reimported = await createSolanaWalletFromPrivateKey(
      first!.privateKey!,
      "Reimported",
    );
    assert.ok(reimported);
    assert.equal(reimported!.address, first!.address);
    assert.equal(reimported!.namespace, "solana");
    assert.equal(reimported!.type, "PrivateKey");
    assert.equal(reimported!.source, "Imported");
    assert.equal(reimported!.solana?.pubkeyBase58, first!.address);
    // §7.3 — private-key imports don't carry a derivation path.
    assert.equal(reimported!.solana?.derivationPath, undefined);
    assert.equal(reimported!.name, "Reimported");
  });

  it("returns null when the base58 input is not a valid Solana key", async () => {
    assert.equal(await createSolanaWalletFromPrivateKey(""), null);
    assert.equal(await createSolanaWalletFromPrivateKey(EVM_HEX_KEY), null);
    assert.equal(
      await createSolanaWalletFromPrivateKey("not-a-valid-base58"),
      null,
    );
  });
});

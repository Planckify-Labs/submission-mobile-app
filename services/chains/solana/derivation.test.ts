/**
 * Golden-vector test for Solana SLIP-0010 derivation.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/solana/derivation.test.ts
 *
 * Node-only — no react / react-native / viem imports. Uses `@solana/kit`'s
 * WebCrypto-backed key APIs, which rely on Node's native Ed25519 support
 * (Node 20+). Mobile uses `@solana/webcrypto-ed25519-polyfill` instead.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getAddressFromPublicKey } from "@solana/addresses";
import { createKeyPairFromPrivateKeyBytes } from "@solana/keys";

import {
  DEFAULT_SOLANA_PATH,
  mnemonicToSolanaPrivateKey,
} from "./derivation.ts";

// BIP-39 canonical test mnemonic. The address below is the ed25519-hd-key
// derivation of `m/44'/501'/0'/0'` (Phantom's current default for new
// wallets — change-level segment appended). Cross-check against Phantom
// import before any future re-derivation refactor.
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const EXPECTED_ADDRESS = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk";

describe("DEFAULT_SOLANA_PATH", () => {
  it("is exactly m/44'/501'/0'/0' (Phantom default, BIP-44 Solana)", () => {
    assert.equal(DEFAULT_SOLANA_PATH, "m/44'/501'/0'/0'");
  });
});

describe("mnemonicToSolanaPrivateKey", () => {
  it("returns a 32-byte Uint8Array for the canonical mnemonic", () => {
    const key = mnemonicToSolanaPrivateKey(TEST_MNEMONIC);
    assert.ok(key instanceof Uint8Array, "expected Uint8Array");
    assert.equal(key.length, 32, "ed25519 seed must be exactly 32 bytes");
  });

  it("uses the default path when none is provided", () => {
    const implicit = mnemonicToSolanaPrivateKey(TEST_MNEMONIC);
    const explicit = mnemonicToSolanaPrivateKey(
      TEST_MNEMONIC,
      DEFAULT_SOLANA_PATH,
    );
    assert.deepEqual(implicit, explicit);
  });

  it("derives the Phantom-verified address for the golden vector", async () => {
    const privateKeyBytes = mnemonicToSolanaPrivateKey(TEST_MNEMONIC);
    const { publicKey } =
      await createKeyPairFromPrivateKeyBytes(privateKeyBytes);
    const address = await getAddressFromPublicKey(publicKey);
    const actual = address.toString();

    if (actual !== EXPECTED_ADDRESS) {
      // One-shot log so the orchestrator can update the hard-coded vector.
      // Intentionally does NOT log the private-key bytes.
      console.log(
        `[derivation.test] actual derived address for canonical mnemonic + ${DEFAULT_SOLANA_PATH}: ${actual}`,
      );
    }

    assert.equal(
      actual,
      EXPECTED_ADDRESS,
      "derived base58 address must match Phantom-verified vector",
    );
  });
});

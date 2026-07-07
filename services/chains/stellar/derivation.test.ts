/**
 * Golden-vector test for Stellar SLIP-0010 derivation.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §1.2, §9.
 *
 * Verifies against SEP-0005's own published first test vector — not a
 * third-party package's output:
 *
 *   Mnemonic: illness spike retreat truth genius clock brain pass fit
 *             cave bargain toe
 *   m/44'/148'/0' → GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6
 *                    / SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN
 */

import { Keypair } from "@stellar/stellar-base";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_STELLAR_PATH,
  mnemonicToStellarPrivateKey,
} from "./derivation.ts";

const SEP0005_MNEMONIC =
  "illness spike retreat truth genius clock brain pass fit cave bargain toe";
const SEP0005_PUBLIC =
  "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

describe("DEFAULT_STELLAR_PATH", () => {
  it("is exactly m/44'/148'/0' (SEP-0005 primary key)", () => {
    expect(DEFAULT_STELLAR_PATH).toBe("m/44'/148'/0'");
  });
});

describe("mnemonicToStellarPrivateKey", () => {
  it("returns a 32-byte Uint8Array for the canonical mnemonic", () => {
    const key = mnemonicToStellarPrivateKey(TEST_MNEMONIC);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("matches the SEP-0005 official first test vector", () => {
    const seed = mnemonicToStellarPrivateKey(SEP0005_MNEMONIC);
    const keypair = Keypair.fromRawEd25519Seed(Buffer.from(seed));
    expect(keypair.publicKey()).toBe(SEP0005_PUBLIC);
  });

  it("uses the default path when none is provided", () => {
    const implicit = mnemonicToStellarPrivateKey(TEST_MNEMONIC);
    const explicit = mnemonicToStellarPrivateKey(
      TEST_MNEMONIC,
      DEFAULT_STELLAR_PATH,
    );
    expect(implicit).toEqual(explicit);
  });

  it("derives a canonical G... address for the canonical mnemonic", () => {
    const seed = mnemonicToStellarPrivateKey(TEST_MNEMONIC);
    const address = Keypair.fromRawEd25519Seed(Buffer.from(seed)).publicKey();
    expect(address).toMatch(STELLAR_ADDRESS_RE);
  });

  it("is deterministic: same mnemonic + same path yields identical seed across two calls", () => {
    const a = mnemonicToStellarPrivateKey(TEST_MNEMONIC);
    const b = mnemonicToStellarPrivateKey(TEST_MNEMONIC, DEFAULT_STELLAR_PATH);
    expect(a).toEqual(b);
  });

  it("derives different seeds for different account indices", () => {
    const a = mnemonicToStellarPrivateKey(TEST_MNEMONIC);
    const b = mnemonicToStellarPrivateKey(TEST_MNEMONIC, "m/44'/148'/1'");
    expect(a).not.toEqual(b);
  });
});

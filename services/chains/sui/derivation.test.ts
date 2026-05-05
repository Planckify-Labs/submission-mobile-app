/**
 * Golden-vector test for Sui SLIP-0010 derivation.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §1.4, §3.2, §6.
 *
 * Verifies cross-wallet parity (Sui Wallet / Suiet / Surf) for the BIP-39
 * canonical zero mnemonic at `m/44'/784'/0'/0'/0'`.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_SUI_PATH, mnemonicToSuiKeypair } from "./derivation.ts";

// BIP-39 canonical test mnemonic.
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// Golden vector derived via @mysten/sui v2.16.0 `Ed25519Keypair.deriveKeypair`
// at the default 5-level fully-hardened path m/44'/784'/0'/0'/0'. Cross-check
// against Sui Wallet / Suiet / Surf import before any future re-derivation
// refactor.
const EXPECTED_ADDRESS =
  "0x5e93a736d04fbb25737aa40bee40171ef79f65fae833749e3c089fe7cc2161f1";

const SUI_ADDRESS_RE = /^0x[0-9a-f]{64}$/;

describe("DEFAULT_SUI_PATH", () => {
  it("is exactly m/44'/784'/0'/0'/0' (Sui Wallet / Suiet / Surf default)", () => {
    expect(DEFAULT_SUI_PATH).toBe("m/44'/784'/0'/0'/0'");
  });
});

describe("mnemonicToSuiKeypair", () => {
  it("derives an address matching the 0x + 64-hex Sui shape for the canonical mnemonic", () => {
    const keypair = mnemonicToSuiKeypair(TEST_MNEMONIC);
    const address = keypair.toSuiAddress();
    expect(address).toMatch(SUI_ADDRESS_RE);
  });

  it("derives the SDK-verified golden address for the canonical mnemonic", () => {
    const address = mnemonicToSuiKeypair(TEST_MNEMONIC).toSuiAddress();
    expect(address).toBe(EXPECTED_ADDRESS);
  });

  it("is deterministic: same mnemonic + same path yields identical address across two calls", () => {
    const a = mnemonicToSuiKeypair(TEST_MNEMONIC).toSuiAddress();
    const b = mnemonicToSuiKeypair(
      TEST_MNEMONIC,
      DEFAULT_SUI_PATH,
    ).toSuiAddress();
    expect(a).toBe(b);
  });

  it("derives different addresses for different paths (account index 1)", () => {
    const a = mnemonicToSuiKeypair(TEST_MNEMONIC).toSuiAddress();
    const b = mnemonicToSuiKeypair(
      TEST_MNEMONIC,
      "m/44'/784'/1'/0'/0'",
    ).toSuiAddress();
    expect(a).not.toBe(b);
    expect(b).toMatch(SUI_ADDRESS_RE);
  });

  it("throws for an empty mnemonic", () => {
    expect(() => mnemonicToSuiKeypair("")).toThrow();
  });

  it("throws for a non-BIP-39 mnemonic string", () => {
    expect(() =>
      mnemonicToSuiKeypair("not a valid bip39 mnemonic phrase at all here ok"),
    ).toThrow();
  });
});

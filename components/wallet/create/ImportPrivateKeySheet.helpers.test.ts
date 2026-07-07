/**
 * Unit tests for `ImportPrivateKeySheet.helpers` (spec §14.6, Task 25).
 *
 * Matches the Node test runner style used by
 * `inferNamespaceFromKey.test.ts` / `computeNextSelection.test.ts`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     components/wallet/create/ImportPrivateKeySheet.helpers.test.ts
 *
 * Node-only — no react / react-native / viem imports. The tests instead
 * register a minimal in-memory mock of each kit's validator so we can
 * exercise the helper without booting the real `EvmWalletKit` /
 * `SolanaWalletKit` (which pull in viem and the Solana codec).
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { walletKitRegistry } from "../../../services/walletKit/registry.ts";
import type { WalletKitAdapter } from "../../../services/walletKit/types.ts";
import {
  buildAddWalletParams,
  computeValidationState,
  normalizePrivateKeyInput,
} from "./ImportPrivateKeySheet.helpers.ts";

// ── Minimal kit mocks ──────────────────────────────────────────────────
// We only need `namespace` + `validatePrivateKey`; every other method is
// stubbed with a thrower so a stray call during these tests would be
// loud. The registry is a process-wide singleton, so each test cleans
// up via `clear()`.

const notImpl = (name: string) => () => {
  throw new Error(`mock kit: ${name} not implemented`);
};

function makeEvmMock(): WalletKitAdapter {
  return {
    namespace: "eip155",
    supportsPrivateKeyImport: true,
    validateAddress: notImpl("validateAddress"),
    validatePrivateKey: (pk: string) => /^(0x)?[0-9a-fA-F]{64}$/.test(pk),
    validateMnemonic: notImpl("validateMnemonic"),
    createWalletFromPrivateKey: notImpl(
      "createWalletFromPrivateKey",
    ) as WalletKitAdapter["createWalletFromPrivateKey"],
    createWalletFromMnemonic: notImpl(
      "createWalletFromMnemonic",
    ) as WalletKitAdapter["createWalletFromMnemonic"],
    generateMnemonic: notImpl("generateMnemonic"),
    getSignerForWallet: notImpl(
      "getSignerForWallet",
    ) as WalletKitAdapter["getSignerForWallet"],
    getNativeBalance: notImpl(
      "getNativeBalance",
    ) as WalletKitAdapter["getNativeBalance"],
    sendNativeTransfer: notImpl(
      "sendNativeTransfer",
    ) as WalletKitAdapter["sendNativeTransfer"],
    estimateMaxTransferable: notImpl(
      "estimateMaxTransferable",
    ) as WalletKitAdapter["estimateMaxTransferable"],
    formatNativeAmount: notImpl("formatNativeAmount"),
    parseNativeAmount: notImpl("parseNativeAmount"),
    truncateAddress: notImpl("truncateAddress"),
  };
}

function makeSolanaMock(): WalletKitAdapter {
  // Base58 alphabet (Bitcoin/Ripple), 32- or 64-byte decoded lengths
  // translate to 43–44 and 87–88 printable chars respectively. For the
  // helper tests we only need the 87–88 branch (Phantom export).
  const base58 = /^[1-9A-HJ-NP-Za-km-z]{43,88}$/;
  return {
    namespace: "solana",
    supportsPrivateKeyImport: true,
    validateAddress: notImpl("validateAddress"),
    // Reject anything that looks hex-like so the cross-curve guard
    // test is meaningful: a 64-hex EVM key must NOT pass here.
    validatePrivateKey: (pk: string) => {
      if (/^(0x)?[0-9a-fA-F]{64}$/.test(pk)) return false;
      return base58.test(pk);
    },
    validateMnemonic: notImpl("validateMnemonic"),
    createWalletFromPrivateKey: notImpl(
      "createWalletFromPrivateKey",
    ) as WalletKitAdapter["createWalletFromPrivateKey"],
    createWalletFromMnemonic: notImpl(
      "createWalletFromMnemonic",
    ) as WalletKitAdapter["createWalletFromMnemonic"],
    generateMnemonic: notImpl("generateMnemonic"),
    getSignerForWallet: notImpl(
      "getSignerForWallet",
    ) as WalletKitAdapter["getSignerForWallet"],
    getNativeBalance: notImpl(
      "getNativeBalance",
    ) as WalletKitAdapter["getNativeBalance"],
    sendNativeTransfer: notImpl(
      "sendNativeTransfer",
    ) as WalletKitAdapter["sendNativeTransfer"],
    estimateMaxTransferable: notImpl(
      "estimateMaxTransferable",
    ) as WalletKitAdapter["estimateMaxTransferable"],
    formatNativeAmount: notImpl("formatNativeAmount"),
    parseNativeAmount: notImpl("parseNativeAmount"),
    truncateAddress: notImpl("truncateAddress"),
  };
}

beforeEach(() => {
  walletKitRegistry.clear();
  walletKitRegistry.register(makeEvmMock());
  walletKitRegistry.register(makeSolanaMock());
});

afterEach(() => {
  walletKitRegistry.clear();
});

// ── normalizePrivateKeyInput ───────────────────────────────────────────

describe("normalizePrivateKeyInput", () => {
  const EVM_KEY =
    "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";

  it("EVM: trims whitespace", () => {
    assert.equal(
      normalizePrivateKeyInput(`   ${EVM_KEY}   \n`, "eip155"),
      EVM_KEY,
    );
  });

  it("EVM: strips 0x prefix", () => {
    assert.equal(normalizePrivateKeyInput(`0x${EVM_KEY}`, "eip155"), EVM_KEY);
  });

  it("EVM: input with and without 0x prefix normalises to the same string", () => {
    const withPrefix = normalizePrivateKeyInput(`0x${EVM_KEY}`, "eip155");
    const withoutPrefix = normalizePrivateKeyInput(EVM_KEY, "eip155");
    assert.equal(withPrefix, withoutPrefix);
  });

  it("EVM: strips 0X (uppercase) prefix too", () => {
    assert.equal(normalizePrivateKeyInput(`0X${EVM_KEY}`, "eip155"), EVM_KEY);
  });

  it("Solana: trims whitespace but does not strip 0x", () => {
    // `0x…` is not a legal base58 prefix but we still must NOT silently
    // re-encode on the Solana path.
    const pasted = "  0xAbCdEf  ";
    assert.equal(normalizePrivateKeyInput(pasted, "solana"), "0xAbCdEf");
  });

  it("Solana: leaves mid-string content untouched", () => {
    const b58 = "1".repeat(88);
    assert.equal(normalizePrivateKeyInput(`\t${b58}\n`, "solana"), b58);
  });
});

// ── computeValidationState ─────────────────────────────────────────────

describe("computeValidationState", () => {
  const EVM_KEY =
    "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
  const SOL_B58 = "1".repeat(88);

  describe("empty states", () => {
    it("returns 'empty' for whitespace-only input", () => {
      assert.equal(computeValidationState("   \n", "eip155"), "empty");
    });

    it("returns 'empty' for the empty string", () => {
      assert.equal(computeValidationState("", "eip155"), "empty");
    });

    it("returns 'empty' when namespace is null", () => {
      assert.equal(computeValidationState(EVM_KEY, null), "empty");
    });
  });

  describe("EVM (eip155)", () => {
    it("'invalid' for a short hex string", () => {
      assert.equal(computeValidationState("0xdeadbeef", "eip155"), "invalid");
    });

    it("'valid' for a 64-hex string without 0x prefix", () => {
      assert.equal(computeValidationState(EVM_KEY, "eip155"), "valid");
    });

    it("'valid' for a 64-hex string with 0x prefix", () => {
      assert.equal(computeValidationState(`0x${EVM_KEY}`, "eip155"), "valid");
    });

    it("'invalid' for non-hex gibberish", () => {
      assert.equal(
        computeValidationState("definitely not a key", "eip155"),
        "invalid",
      );
    });
  });

  describe("Solana", () => {
    it("'invalid' for a short base58 string", () => {
      assert.equal(computeValidationState("1".repeat(10), "solana"), "invalid");
    });

    it("'valid' for a Phantom-length base58 string", () => {
      assert.equal(computeValidationState(SOL_B58, "solana"), "valid");
    });

    it("'invalid' for base58-ish input with forbidden characters", () => {
      // Contains '0' which is not in the base58 alphabet.
      assert.equal(
        computeValidationState(`0${"1".repeat(87)}`, "solana"),
        "invalid",
      );
    });
  });

  describe("cross-curve reject (TWV-2026-057 rule)", () => {
    it("a valid 64-hex EVM key marked as 'solana' returns 'invalid'", () => {
      // This is the hard rule: a user on the Solana chain card pasting
      // an EVM key must be blocked before any wallet is minted.
      assert.equal(computeValidationState(EVM_KEY, "solana"), "invalid");
    });

    it("a 0x-prefixed EVM key marked as 'solana' is also invalid", () => {
      assert.equal(computeValidationState(`0x${EVM_KEY}`, "solana"), "invalid");
    });

    it("correct key on correct chain returns 'valid' for both sides", () => {
      assert.equal(computeValidationState(EVM_KEY, "eip155"), "valid");
      assert.equal(computeValidationState(SOL_B58, "solana"), "valid");
    });
  });
});

// ── buildAddWalletParams ────────────────────────────────────────────────
//
// Regression guard: this previously only special-cased `"solana"` and
// fell back to `"PrivateKey"` (the EVM source) for every other
// namespace, so importing a Sui or Stellar private key silently built
// an EVM params object and mis-routed the wallet.

describe("buildAddWalletParams", () => {
  it("maps eip155 to the historic 'PrivateKey' source", () => {
    assert.deepEqual(buildAddWalletParams("eip155", "0xkey", "My EVM"), {
      source: "PrivateKey",
      privateKey: "0xkey",
      name: "My EVM",
    });
  });

  it("maps solana to 'SolanaPrivateKey'", () => {
    assert.deepEqual(buildAddWalletParams("solana", "b58key", undefined), {
      source: "SolanaPrivateKey",
      privateKey: "b58key",
      name: undefined,
    });
  });

  it("maps sui to 'SuiPrivateKey' (not the EVM fallback)", () => {
    assert.deepEqual(buildAddWalletParams("sui", "suiprivkey1abc", "My Sui"), {
      source: "SuiPrivateKey",
      privateKey: "suiprivkey1abc",
      name: "My Sui",
    });
  });

  it("maps stellar to 'StellarPrivateKey' (not the EVM fallback)", () => {
    assert.deepEqual(buildAddWalletParams("stellar", "SABC123", "My Stellar"), {
      source: "StellarPrivateKey",
      privateKey: "SABC123",
      name: "My Stellar",
    });
  });
});

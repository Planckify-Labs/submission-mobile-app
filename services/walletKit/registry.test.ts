/**
 * Unit tests for `walletKitRegistry`.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/walletKit/registry.test.ts
 *
 * Node-only — no react / react-native / viem imports.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { WalletKitRegistryImpl, walletKitRegistry } from "./registry.ts";
import type { Namespace, WalletKitAdapter } from "./types.ts";

/** Minimal stub adapter — interface-only task, so all methods are no-ops. */
function makeAdapter(namespace: Namespace): WalletKitAdapter {
  return {
    namespace,
    validateAddress: () => true,
    validatePrivateKey: () => true,
    validateMnemonic: () => true,
    createWalletFromPrivateKey: async () => {
      throw new Error("stub");
    },
    createWalletFromMnemonic: async () => {
      throw new Error("stub");
    },
    generateMnemonic: () => "",
    getSignerForWallet: async () => null,
    getNativeBalance: async () => 0n,
    sendNativeTransfer: async () => "",
    estimateMaxTransferable: async () => 0n,
    formatNativeAmount: () => "",
    parseNativeAmount: () => 0n,
    truncateAddress: () => "",
  };
}

describe("walletKitRegistry (singleton smoke)", () => {
  beforeEach(() => {
    walletKitRegistry.clear();
  });

  it("exports a shared singleton instance", () => {
    assert.ok(walletKitRegistry instanceof WalletKitRegistryImpl);
  });
});

describe("WalletKitRegistryImpl", () => {
  let registry: WalletKitRegistryImpl;

  beforeEach(() => {
    registry = new WalletKitRegistryImpl();
  });

  it("register + get round-trips a kit by namespace", () => {
    const evm = makeAdapter("eip155");
    registry.register(evm);
    assert.equal(registry.get("eip155"), evm);
  });

  it("get throws with a clear message for an unregistered namespace", () => {
    assert.throws(
      () => registry.get("solana"),
      (err: unknown) =>
        err instanceof Error &&
        err.message === "WalletKit not registered for namespace: solana",
    );
  });

  it("has reflects registration state", () => {
    assert.equal(registry.has("eip155"), false);
    registry.register(makeAdapter("eip155"));
    assert.equal(registry.has("eip155"), true);
    assert.equal(registry.has("solana"), false);
  });

  it("getAll() preserves insertion order (EVM first, Solana second)", () => {
    const evm = makeAdapter("eip155");
    const solana = makeAdapter("solana");
    registry.register(evm);
    registry.register(solana);

    const all = registry.getAll();
    assert.equal(all.length, 2);
    assert.equal(all[0], evm);
    assert.equal(all[1], solana);
    assert.deepEqual(
      all.map((k) => k.namespace),
      ["eip155", "solana"],
    );
  });

  it("getAll() returns an empty array when nothing is registered", () => {
    assert.deepEqual(registry.getAll(), []);
  });

  it("re-registering overwrites the prior entry for the same namespace", () => {
    const first = makeAdapter("eip155");
    const second = makeAdapter("eip155");
    registry.register(first);
    registry.register(second);
    assert.equal(registry.get("eip155"), second);
    assert.equal(registry.getAll().length, 1);
  });
});

/**
 * Source-level invariants for walletService — TWV-2026-002 (CSPRNG
 * mnemonic generation) and TWV-2026-060 (serialised auth-gated writes).
 *
 * A full behavioural test requires booting the whole RN module graph
 * (expo-secure-store, @/constants/*, MMKV). We assert the invariants
 * via source inspection + the standalone `@scure/bip39` path that
 * doesn't need the RN runtime.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/walletService.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { entropyToMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";

const src = readFileSync(
  new URL("./walletService.ts", import.meta.url),
  "utf-8",
);

describe("walletService — CSPRNG invariants (TWV-2026-002)", () => {
  it("globalThis.crypto.getRandomValues is a function in the harness", () => {
    assert.equal(typeof globalThis.crypto?.getRandomValues, "function");
  });

  it("source fails loud if the CSPRNG polyfill is missing at import", () => {
    assert.match(
      src,
      /typeof globalThis\.crypto\?\.getRandomValues !== "function"[\s\S]*?throw new Error/,
    );
  });

  it("generateWalletMnemonic routes entropy through crypto.getRandomValues", () => {
    assert.match(
      src,
      /generateWalletMnemonic[\s\S]*?globalThis\.crypto\.getRandomValues\(entropy\)/,
    );
  });

  it("generateWalletMnemonic validates the BIP-39 checksum", () => {
    // Mirror of the production path — verify `@scure/bip39`'s
    // entropy-to-mnemonic produces valid checksums. This is the
    // property the source assertion relies on.
    const entropy = new Uint8Array(16);
    globalThis.crypto.getRandomValues(entropy);
    const m = entropyToMnemonic(entropy, englishWordlist);
    assert.equal(validateMnemonic(m, englishWordlist), true);
  });
});

describe("walletService — TWV-2026-060 bundle storage layout", () => {
  it("defines a bundle-mode key separate from the legacy per-wallet prefix", () => {
    assert.match(src, /WALLET_BUNDLE_KEY\s*=\s*"wallets_bundle_v1"/);
    assert.match(src, /WALLET_INDEX_KEY\s*=\s*"wallet_index"/);
  });

  it("saveWalletsToStorage writes exactly ONE auth-gated entry (the bundle)", () => {
    // Exactly one `signingSecureSet` call on the save path — the
    // bundle. NO per-wallet auth-gated writes (would scale N prompts).
    const saveBlock = src.match(
      /saveWalletsToStorage[\s\S]*?lastSave\s*=\s*next;/,
    );
    assert.ok(saveBlock);
    const sigSetCalls = (saveBlock[0].match(/signingSecureSet/g) ?? []).length;
    assert.equal(sigSetCalls, 1, `expected 1 signingSecureSet in save; got ${sigSetCalls}`);
    // The old per-wallet loop must not exist.
    assert.doesNotMatch(
      saveBlock[0],
      /for \(const wallet of wallets\)[\s\S]*?signingSecureSet\(walletKey/,
    );
  });

  it("loadWalletsFromStorage tries the bundle FIRST", () => {
    assert.match(
      src,
      /signingSecureGet\(WALLET_BUNDLE_KEY\)[\s\S]*?if \(bundleData\)/,
    );
  });

  it("loadWalletsFromStorage migrates legacy per-wallet entries to the bundle", () => {
    // Fallback path iterates legacy per-wallet keys and writes the
    // bundle once the migration is done.
    assert.match(
      src,
      /for \(const address of walletAddresses\)[\s\S]*?signingSecureGet\(walletKey\)/,
    );
    assert.match(
      src,
      /signingSecureSet\(\s*WALLET_BUNDLE_KEY,\s*JSON\.stringify/,
    );
  });

  it("WALLET_INDEX_KEY uses the non-auth helper (public address list)", () => {
    assert.match(src, /walletSecureSet\(\s*WALLET_INDEX_KEY/);
    assert.doesNotMatch(src, /signingSecureSet\(\s*WALLET_INDEX_KEY/);
  });
});

describe("walletService — single-flight guards (no prompt cascade)", () => {
  it("loadWalletsFromStorage shares an in-flight promise", () => {
    assert.match(src, /let inFlightLoad:\s*Promise<TWallet\[\]> \| null/);
    assert.match(src, /if \(inFlightLoad\) return inFlightLoad/);
  });

  it("saveWalletsToStorage chains saves via a rolling lastSave promise", () => {
    assert.match(src, /let lastSave:\s*Promise<unknown>/);
    assert.match(src, /lastSave\s*=\s*next/);
  });

  it("save-error path does NOT null cachedWallets", () => {
    // Nulling on every transient save failure forces a full re-read
    // on the next mount — another round of biometric prompts.
    const errorBlock = src.match(/catch \(error\)[\s\S]*?Failed to save wallets[\s\S]*?return false/);
    assert.ok(errorBlock);
    assert.doesNotMatch(errorBlock[0], /cachedWallets\s*=\s*null/);
  });
});

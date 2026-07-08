/**
 * `installStellarSigner` — source-level invariants.
 *
 * Spec reference: `docs/stellar-dapp-bridge-spec.md` §10, §11.
 *
 * Same "grep-style over source" rationale as `StellarAdapter.test.ts` —
 * this module transitively imports `@/services/walletService.ts`
 * (`expo-secure-store`) and `@/services/walletKit/registry`, which plain
 * `node --test` can't resolve without the RN harness.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/stellar/signer.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const src = readFileSync(new URL("./signer.ts", import.meta.url), "utf-8");

describe("installStellarSigner — TWV-2026-090 dwell site (§10)", () => {
  it("resolves the keypair via getStellarSignerForWallet, not a raw Keypair reconstruction", () => {
    assert.match(src, /await\s+getStellarSignerForWallet\(wallet\)/);
  });

  it("imports getStellarSignerForWallet from services/walletService", () => {
    assert.match(
      src,
      /import\s*{\s*getStellarSignerForWallet\s*}\s*from\s*"@\/services\/walletService"/,
    );
  });

  it("does not call Keypair.fromRawEd25519Seed itself (TWV-2026-090 — single dwell site)", () => {
    assert.doesNotMatch(src, /fromRawEd25519Seed/);
  });
});

describe("installStellarSigner — Hermes base64 safety (§10, §11)", () => {
  it("signTransaction serialises via transactionToBase64Xdr, never tx.toXDR() directly", () => {
    assert.match(src, /transactionToBase64Xdr\(tx\)/);
    // The doc comment above the call legitimately references the banned
    // pattern by name as a warning — only the real code line matters.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(codeOnly, /tx\.toXDR\(\)/);
  });

  it('signMessage uses .toString("hex"), not .toString("base64")', () => {
    assert.match(src, /raw\.toString\(\s*"hex"\s*\)/);
  });
});

describe("installStellarSigner — submit path never consults submitUrl (§1.8)", () => {
  it("submits only via deps.getHorizonClient(opts.chain), no submitUrl reference", () => {
    assert.match(src, /deps!\.getHorizonClient\(opts\.chain\)/);
    assert.doesNotMatch(src, /opts\.submitUrl/);
  });

  it("sign-only path (submit falsy) returns before resolving a Horizon client", () => {
    assert.match(
      src,
      /if\s*\(!opts\.submit\)\s*return\s*{\s*signedTxXdr,\s*signerAddress:\s*address\s*};/,
    );
  });
});

describe("installStellarSigner — registration + guard shape", () => {
  it("short-circuits when the Stellar kit isn't registered", () => {
    assert.match(
      src,
      /if\s*\(!walletKitRegistry\.has\(\s*"stellar"\s*\)\)\s*return;/,
    );
  });

  it("registers via registerStellarSigner (single seam, mirrors installSuiSigner)", () => {
    assert.match(src, /registerStellarSigner\(handlers\)/);
  });
});

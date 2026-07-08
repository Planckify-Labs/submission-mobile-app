/**
 * Source-level invariants for `services/bridge/boot.ts`.
 *
 * Behavioural boot tests need TS path-alias resolution + a real adapter
 * runtime + the React Native + WebView shims, which plain `node --test`
 * can't provide. Mirroring `DappBridge.test.ts`, we lock the load-bearing
 * shape with grep-style assertions.
 *
 * NOTE: post-`docs/sui-dapp-bridge-task/20_flip_feature_flag` the flag is
 * `true`. The "scaffold guard" assertions on flag-presence + flag-gated
 * register/install calls remain — they're load-bearing whenever a future
 * roll-back temporarily flips the flag back to `false` (e.g. emergency
 * regression). The tests no longer pin the literal value.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/bridge/boot.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { ChainAdapterRegistry } from "../chains/registry.ts";

const src = readFileSync(new URL("./boot.ts", import.meta.url), "utf-8");

describe("bootBridge — Sui flag + register-adjacent invariants", () => {
  it("declares FEATURE_SUI_DAPP_BRIDGE as a boolean literal", () => {
    // Either value is allowed; the variable must exist with a literal
    // boolean so the boot path remains a one-line flip in either
    // direction. Indirection (env var, settings store) defeats the
    // single-line-diff property the spec relies on.
    assert.match(
      src,
      /const\s+FEATURE_SUI_DAPP_BRIDGE\s*=\s*(?:true|false)\s*;/,
    );
  });

  it("Sui adapter registration sits behind the flag", () => {
    // Spec §3.2 / §10. Partial wiring is forbidden. The adapter
    // `register` call must live inside the `if (FEATURE_SUI_DAPP_BRIDGE)`
    // block, not outside it.
    assert.match(
      src,
      /if\s*\(FEATURE_SUI_DAPP_BRIDGE\)[\s\S]*?ChainAdapterRegistry\.register\(\s*createSuiAdapter\(\)\s*\)/,
    );
  });

  it("installSuiSigner is called from inside the guarded block", () => {
    assert.match(
      src,
      /if\s*\(FEATURE_SUI_DAPP_BRIDGE\)[\s\S]*?installSuiSigner\(/,
    );
  });

  it('installSuiSigner sits behind walletKitRegistry.has("sui") guard', () => {
    // §10 boot-order precondition. If the Sui kit is missing, the bridge
    // must NOT throw — it warns + auto-retries (`booted = false`). This
    // mirrors the Solana guard at `:100-121`.
    assert.match(
      src,
      /walletKitRegistry\.has\(\s*"sui"\s*\)[\s\S]*?installSuiSigner/,
    );
  });

  it("Sui inspectors are registered (decoder, simulation, SIWS)", () => {
    // Phase 5 / Task 14 — without this, intents reach the sheets without
    // PTB decoding or simulation summary.
    for (const name of [
      "SuiPtbDecoderInspector",
      "SuiSimulationInspector",
      "SuiSiwsInspector",
    ]) {
      assert.match(
        src,
        new RegExp(`InspectorRegistry\\.register\\(${name}\\)`),
        `${name} is not registered in bootBridge`,
      );
    }
  });

  it("TelemetrySink is subscribed to the bridge event bus", () => {
    // Task 15 — chain=sui Sentry tags + per-method timers ride this
    // sink. Subscription happens once during boot.
    assert.match(src, /bridgeEventBus\.subscribe\(\s*TelemetrySink\s*\)/);
  });

  it("imports the Sui scaffold symbols (matches one-line-flip property)", () => {
    assert.match(
      src,
      /import\s*\{\s*createSuiAdapter\s*\}\s*from\s*"@\/services\/chains\/sui\/SuiAdapter"/,
    );
    assert.match(
      src,
      /import\s*\{\s*installSuiSigner\s*\}\s*from\s*"@\/services\/chains\/sui\/signer"/,
    );
  });
});

describe("bootBridge — Stellar flag + register-adjacent invariants (docs/stellar-dapp-bridge-spec.md §10)", () => {
  it("declares FEATURE_STELLAR_DAPP_BRIDGE as a boolean literal", () => {
    assert.match(
      src,
      /const\s+FEATURE_STELLAR_DAPP_BRIDGE\s*=\s*(?:true|false)\s*;/,
    );
  });

  it("Stellar adapter registration sits behind the flag", () => {
    assert.match(
      src,
      /if\s*\(FEATURE_STELLAR_DAPP_BRIDGE\)[\s\S]*?ChainAdapterRegistry\.register\(\s*createStellarAdapter\(\)\s*\)/,
    );
  });

  it("installStellarSigner is called from inside the guarded block", () => {
    assert.match(
      src,
      /if\s*\(FEATURE_STELLAR_DAPP_BRIDGE\)[\s\S]*?installStellarSigner\(/,
    );
  });

  it('installStellarSigner sits behind walletKitRegistry.has("stellar") guard', () => {
    assert.match(
      src,
      /walletKitRegistry\.has\(\s*"stellar"\s*\)[\s\S]*?installStellarSigner/,
    );
  });

  it("Stellar inspectors are registered (XDR decoder, preflight)", () => {
    for (const name of [
      "StellarXdrDecoderInspector",
      "StellarPreflightInspector",
    ]) {
      assert.match(
        src,
        new RegExp(`InspectorRegistry\\.register\\(${name}\\)`),
        `${name} is not registered in bootBridge`,
      );
    }
  });

  it("imports the Stellar adapter/signer symbols (matches one-line-flip property)", () => {
    assert.match(
      src,
      /import\s*\{\s*createStellarAdapter\s*\}\s*from\s*"@\/services\/chains\/stellar\/StellarAdapter"/,
    );
    assert.match(
      src,
      /import\s*\{\s*installStellarSigner\s*\}\s*from\s*"@\/services\/chains\/stellar\/signer"/,
    );
  });
});

describe("ChainAdapterRegistry — empty-state default", () => {
  // When nothing has booted (cleared registry), `get("sui")` returns null.
  // After bootBridge runs with the flag ON the registry contains the Sui
  // adapter; that case is exercised in the bridge integration suite, not
  // here, because the registry is module-level state.
  it("returns null for sui on a freshly-cleared registry", () => {
    ChainAdapterRegistry.clear();
    assert.equal(ChainAdapterRegistry.get("sui"), null);
  });

  it("returns null for stellar on a freshly-cleared registry", () => {
    ChainAdapterRegistry.clear();
    assert.equal(ChainAdapterRegistry.get("stellar"), null);
  });
});

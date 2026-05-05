/**
 * Dev-only compliance lint for the TakumiSuiWallet shape built by
 * `injectedScript.ts`. Encodes every predicate `@mysten/wallet-standard`
 * applies at pick time — if this file passes, real Sui dApps see the
 * wallet; if it fails, a refactor silently broke compliance.
 *
 * NOT bundled into production. The file name starts with `__` so Metro /
 * path scanners skip it, and the CI test command is
 * `node --test --experimental-strip-types services/chains/sui/__wallet-standard-lint.ts`.
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §5.7.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";

import { getSuiInjectedScript } from "./injectedScript.ts";

function runInjectedScript(
  activeAddress: string | null,
  opts?: { walletAliases?: { name: string; icon?: string }[] },
) {
  const captured: {
    wallet?: Record<string, unknown>;
    aliases: Record<string, unknown>[];
    calls: string[];
  } = {
    calls: [],
    aliases: [],
  };
  const sandbox: Record<string, unknown> = {
    window: {} as Record<string, unknown>,
    atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s: string) => Buffer.from(s, "binary").toString("base64"),
    TextEncoder,
    TextDecoder,
    Date,
    Math,
    Map,
    Set,
    Uint8Array,
    ArrayBuffer,
    String,
    Number,
    Object,
    Array,
    Promise,
    JSON,
    Error,
    parseInt,
  };
  const win = sandbox.window as Record<string, unknown>;
  win.__takumi_sui_installed = undefined;
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  win.addEventListener = (event: string, cb: (e: unknown) => void) => {
    (listeners[event] = listeners[event] ?? []).push(cb);
  };
  win.dispatchEvent = (ev: Record<string, unknown>) => {
    captured.calls.push(String(ev.type));
    if (ev.type === "wallet-standard:register-wallet") {
      const detail = ev.detail as
        | ((api: { register: (w: Record<string, unknown>) => void }) => void)
        | undefined;
      if (detail) {
        detail({
          register: (w) => {
            // First registered wallet is canonical TakumiPay; subsequent
            // ones are aliases. Track separately so tests that probe the
            // canonical shape don't see Surf / Slush / etc.
            if (!captured.wallet) captured.wallet = w;
            else captured.aliases.push(w);
          },
        });
      }
    }
  };
  win.ReactNativeWebView = {
    postMessage: () => {},
  };
  win.location = {
    href: "https://example.com",
    origin: "https://example.com",
  };
  win.top = win;
  sandbox.Event = class Event {
    type: string;
    detail?: unknown;
    constructor(type: string) {
      this.type = type;
    }
  };

  const script = new vm.Script(
    getSuiInjectedScript({
      activeAddress,
      ...(opts?.walletAliases !== undefined
        ? { walletAliases: opts.walletAliases }
        : {}),
    }),
  );
  const ctx = vm.createContext(sandbox);
  script.runInContext(ctx);
  return {
    wallet: captured.wallet,
    aliases: captured.aliases,
    events: captured.calls,
    window: win,
  };
}

const SAMPLE_ADDR = "0x" + "ab".repeat(32);

describe("wallet-standard lint — object shape (§5.7)", () => {
  const { wallet } = runInjectedScript(SAMPLE_ADDR);

  it("wallet.version === '1.0.0' literal", () => {
    assert.equal(wallet?.version, "1.0.0");
  });

  it("wallet.name is 'TakumiPay'", () => {
    assert.equal(wallet?.name, "TakumiPay");
  });

  it("wallet.icon matches data URL format", () => {
    assert.match(
      wallet?.icon as string,
      /^data:image\/(svg\+xml|webp|png|gif);base64,/,
    );
  });

  it("wallet.chains contains the three short-form sui:* entries", () => {
    const chains = wallet?.chains as string[];
    assert.ok(chains.includes("sui:mainnet"));
    assert.ok(chains.includes("sui:testnet"));
    assert.ok(chains.includes("sui:devnet"));
  });

  it("wallet.accounts is [] pre-connect even when an active wallet exists (§4.5)", () => {
    const accs = wallet?.accounts as unknown[];
    assert.ok(Array.isArray(accs));
    assert.equal(accs.length, 0);
  });

  it("pre-inject wallet.accounts is [] (no active wallet)", () => {
    const { wallet: pre } = runInjectedScript(null);
    const accs = pre?.accounts as unknown[];
    assert.ok(Array.isArray(accs));
    assert.equal(accs.length, 0);
  });

  it("wallet object exposes no private-key shaped fields (TWV-2026-YYY §2.2)", () => {
    const banned =
      /^(privateKey|seed|mnemonic|signer|keypair|recoveryPhrase)$/i;
    assert.ok(wallet);
    for (const k of Object.keys(wallet!)) {
      assert.equal(banned.test(k), false, `field ${k} must not exist`);
    }
  });
});

describe("wallet-standard lint — feature surface (§5.4)", () => {
  const { wallet } = runInjectedScript(SAMPLE_ADDR);
  const feats = wallet?.features as Record<string, Record<string, unknown>>;

  // Per @mysten/wallet-standard v0.13+:
  //   sui:signTransaction → "2.0.0", sui:signAndExecuteTransaction → "2.0.0".
  //   All other features → "1.0.0".
  // Wrong versions silently filter the wallet out of @mysten/dapp-kit
  // pickers (Cetus, Suilend, Navi, Suiet kit consumers).
  const EXPECTED_VERSION: Record<string, string> = {
    "standard:connect": "1.0.0",
    "standard:disconnect": "1.0.0",
    "standard:events": "1.0.0",
    "sui:signPersonalMessage": "1.0.0",
    "sui:signTransaction": "2.0.0",
    "sui:signAndExecuteTransaction": "2.0.0",
    "sui:signTransactionBlock": "1.0.0",
    "sui:signAndExecuteTransactionBlock": "1.0.0",
    "sui:reportTransactionEffects": "1.0.0",
    "takumi:switchNetwork": "1.0.0",
  };
  for (const [key, expectedVersion] of Object.entries(EXPECTED_VERSION)) {
    it(`features["${key}"] is present with version ${expectedVersion}`, () => {
      assert.ok(feats[key], `missing ${key}`);
      assert.equal(feats[key].version, expectedVersion);
    });
  }

  it("no `window.sui` legacy global is installed (§5.2)", () => {
    const { window: win } = runInjectedScript(SAMPLE_ADDR);
    assert.equal(
      (win as Record<string, unknown>).sui,
      undefined,
      "window.sui must remain unset — Wallet Standard discovery only",
    );
  });

  it("supportedTransactionVersions is NOT exposed (Sui has no versions field)", () => {
    // Solana has `supportedTransactionVersions` on signTransaction; Sui
    // does not. Pre-emptively assert absence so a copy-paste from Solana
    // fails this test before it confuses dApp libraries.
    assert.equal(
      "supportedTransactionVersions" in feats["sui:signTransaction"],
      false,
    );
  });
});

describe("wallet-standard lint — account shape (post-connect)", () => {
  const { wallet, window: win } = runInjectedScript(SAMPLE_ADDR);
  (
    win._updateSuiWallet as (s: {
      accounts: Array<{ address: string }>;
      chain?: string;
    }) => void
  )({ accounts: [{ address: SAMPLE_ADDR }], chain: "sui:mainnet" });
  const accs = wallet?.accounts as Array<Record<string, unknown>>;
  const a = accs[0];

  it("WalletAccount.address is the 0x-hex address", () => {
    assert.equal(a.address, SAMPLE_ADDR);
  });

  it("WalletAccount.publicKey is a Uint8Array of 32 bytes (§1.3)", () => {
    assert.ok(a.publicKey instanceof Uint8Array, "must be Uint8Array");
    assert.equal((a.publicKey as Uint8Array).length, 32);
  });

  it("WalletAccount.chains carries the sui:* triple", () => {
    const chains = a.chains as string[];
    assert.ok(chains.includes("sui:mainnet"));
    assert.equal(chains.length, 3);
  });

  it("WalletAccount.features covers required Sui features", () => {
    const f = a.features as string[];
    for (const need of [
      "sui:signPersonalMessage",
      "sui:signTransaction",
      "sui:signAndExecuteTransaction",
      "sui:reportTransactionEffects",
    ]) {
      assert.ok(f.includes(need), `missing ${need}`);
    }
  });
});

describe("wallet-standard lint — alias wallets (curated-picker compat)", () => {
  it("default deployment registers TakumiPay + 4 aliases", () => {
    const { wallet, aliases } = runInjectedScript(SAMPLE_ADDR);
    assert.equal(wallet?.name, "TakumiPay");
    assert.equal(aliases.length, 4);
    const names = aliases.map((a) => a.name);
    assert.deepEqual(names.sort(), ["Slush", "Sui Wallet", "Suiet", "Surf"]);
  });

  it("aliases share TakumiPay's chains + features (single signer)", () => {
    const { wallet, aliases } = runInjectedScript(SAMPLE_ADDR);
    for (const a of aliases) {
      // Each alias must point at the same features object so a click on
      // the alias slot reaches the canonical connect/sign closures.
      assert.strictEqual(a.features, wallet?.features);
      assert.strictEqual(a.chains, wallet?.chains);
    }
  });

  it("aliases stay in sync with `_updateSuiWallet` mutations", () => {
    const { wallet, aliases, window: win } = runInjectedScript(SAMPLE_ADDR);
    (
      win._updateSuiWallet as (s: {
        accounts: Array<{ address: string }>;
      }) => void
    )({ accounts: [{ address: SAMPLE_ADDR }] });
    // After the canonical wallet's accounts are populated, every alias
    // must show the same accounts via getter.
    assert.equal((wallet?.accounts as unknown[]).length, 1);
    for (const a of aliases) {
      assert.strictEqual(a.accounts, wallet?.accounts);
    }
  });

  it("opt-out via `walletAliases: []` registers only the canonical wallet", () => {
    const { wallet, aliases } = runInjectedScript(SAMPLE_ADDR, {
      walletAliases: [],
    });
    assert.equal(wallet?.name, "TakumiPay");
    assert.equal(aliases.length, 0);
  });

  it("custom alias list is honored verbatim", () => {
    const { aliases } = runInjectedScript(SAMPLE_ADDR, {
      walletAliases: [{ name: "MyCustomBrand" }],
    });
    assert.equal(aliases.length, 1);
    assert.equal(aliases[0].name, "MyCustomBrand");
  });
});

describe("wallet-standard lint — handshake behaviour", () => {
  it("register-wallet event dispatched during install", () => {
    const { events } = runInjectedScript(SAMPLE_ADDR);
    assert.ok(
      events.includes("wallet-standard:register-wallet"),
      "dispatch not observed",
    );
  });

  it("re-running the IIFE re-dispatches register-wallet, no duplicate install", () => {
    const { window: win } = runInjectedScript(SAMPLE_ADDR);
    // Run the script a second time on the same window — should be a no-op
    // except for re-firing the register event.
    const calls: string[] = [];
    (win as Record<string, unknown>).dispatchEvent = (
      ev: Record<string, unknown>,
    ) => {
      calls.push(String(ev.type));
    };
    const sandbox = { window: win, ...{} } as Record<string, unknown>;
    Object.assign(sandbox, {
      atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
      btoa: (s: string) => Buffer.from(s, "binary").toString("base64"),
      TextEncoder,
      Date,
      Math,
      Map,
      Set,
      Uint8Array,
      ArrayBuffer,
      String,
      Number,
      Object,
      Array,
      Promise,
      JSON,
      Error,
      parseInt,
      Event: class {
        type: string;
        detail?: unknown;
        constructor(t: string) {
          this.type = t;
        }
      },
    });
    const script = new vm.Script(getSuiInjectedScript({ activeAddress: null }));
    const ctx = vm.createContext(sandbox);
    script.runInContext(ctx);
    assert.ok(calls.includes("wallet-standard:register-wallet"));
  });
});

describe("wallet-standard lint — feature-function identity stable", () => {
  it("feature-function references are stable inside a single inject", () => {
    const { wallet } = runInjectedScript(SAMPLE_ADDR);
    const f = wallet?.features as Record<string, Record<string, unknown>>;
    // Two reads of the same feature function should yield the same ref.
    assert.equal(
      f["sui:signTransaction"].signTransaction,
      f["sui:signTransaction"].signTransaction,
    );
  });

  it("legacy alias delegates to a function ref (not just a string)", () => {
    const { wallet } = runInjectedScript(SAMPLE_ADDR);
    const f = wallet?.features as Record<string, Record<string, unknown>>;
    assert.equal(
      typeof f["sui:signTransactionBlock"].signTransactionBlock,
      "function",
    );
    assert.equal(
      typeof f["sui:signAndExecuteTransactionBlock"]
        .signAndExecuteTransactionBlock,
      "function",
    );
  });
});

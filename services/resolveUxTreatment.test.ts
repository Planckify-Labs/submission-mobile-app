/**
 * Unit tests for `resolveUXTreatment()` and `resolveFromPolicy()`.
 *
 * Run from the mobile-app root with:
 *
 *     node --test --experimental-strip-types services/resolveUxTreatment.test.ts
 *
 * These are integration-level tests against a real `PermissionGrantStore`
 * — `resolveGrant` is never mocked. We inject an in-memory
 * `GrantStorageAdapter` so no native modules are touched.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type GrantStorageAdapter,
  PermissionGrantStore,
} from "./permissionGrantStore.ts";
import {
  type ApprovalPolicy,
  type ConnectedWallet,
  HOT_WALLET_POLICY,
  resolveFromPolicy,
  resolveUXTreatment,
  WATCH_ONLY_POLICY,
} from "./resolveUxTreatment.ts";

const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const SESSION_ID = "session-xyz";

function makeMemoryAdapter(): GrantStorageAdapter {
  const store = new Map<string, string>();
  return {
    async getItem(key) {
      return store.get(key) ?? null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async deleteItem(key) {
      store.delete(key);
    },
  };
}

async function freshWallet(
  approvalPolicy: ApprovalPolicy,
): Promise<ConnectedWallet> {
  const grantStore = new PermissionGrantStore(WALLET, makeMemoryAdapter());
  await grantStore.whenLoaded();
  return {
    address: WALLET,
    approvalPolicy,
    grantStore,
  };
}

describe("resolveUXTreatment — policy-only paths (no grants)", () => {
  it("watch-only wallet + write → blocked", async () => {
    const wallet = await freshWallet(WATCH_ONLY_POLICY);
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "blocked");
  });

  it("hot wallet + write → confirm", async () => {
    const wallet = await freshWallet(HOT_WALLET_POLICY);
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "confirm");
  });

  it("hot wallet + approve_erc20 → confirm via tool override", async () => {
    // Start from a custom hot-wallet-like policy that would otherwise
    // treat writes as `preview`, so the override is the only thing that
    // could produce `confirm`. This proves the override path is taken,
    // not the capability base.
    const policy: ApprovalPolicy = {
      read: "silent",
      simulate: "preview",
      write: "preview",
      tool_overrides: { approve_erc20: "confirm" },
    };
    const wallet = await freshWallet(policy);
    const treatment = resolveUXTreatment(
      "write",
      "approve_erc20",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "confirm");
  });

  it("hot wallet's default approve_erc20 override still confirms", async () => {
    const wallet = await freshWallet(HOT_WALLET_POLICY);
    const treatment = resolveUXTreatment(
      "write",
      "approve_erc20",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "confirm");
  });

  it("hot wallet + x402_fetch → silent (agent micropayment, no prompt)", async () => {
    // Spec Phase 5 §6.2 / acceptance #1: settles silently within the
    // pre-signed allowance — must NOT fall through to the write→confirm
    // default. The executor self-escalates over-budget calls.
    const wallet = await freshWallet(HOT_WALLET_POLICY);
    const treatment = resolveUXTreatment(
      "write",
      "x402_fetch",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "silent");
  });
});

describe("resolveUXTreatment — grant-driven paths", () => {
  it("active session grant + write → silent", async () => {
    const wallet = await freshWallet(HOT_WALLET_POLICY);
    wallet.grantStore.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "session", session_id: SESSION_ID },
      wallet_address: WALLET,
      granted_at: Date.now(),
    });
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "silent");
  });

  it("active permanent global grant + write → silent", async () => {
    const wallet = await freshWallet(HOT_WALLET_POLICY);
    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET,
      granted_at: Date.now(),
    });
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "silent");
  });

  it("always_ask at tool scope overrides a global permanent grant", async () => {
    const wallet = await freshWallet(HOT_WALLET_POLICY);
    // Install an autonomous-style global permanent grant first...
    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET,
      granted_at: Date.now(),
    });
    // ...then lock down one specific tool with always_ask.
    wallet.grantStore.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "always_ask" },
      wallet_address: WALLET,
      granted_at: Date.now(),
    });
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "confirm");

    // Sanity check: an unrelated tool still runs silently under the
    // global permanent grant — proving the always_ask is scoped, not
    // accidentally global.
    const otherTool = resolveUXTreatment(
      "write",
      "write_contract",
      wallet,
      SESSION_ID,
    );
    assert.equal(otherTool, "silent");
  });
});

describe("resolveUXTreatment — auto_approve_below_usd downgrade", () => {
  const POLICY_WITH_THRESHOLD: ApprovalPolicy = {
    read: "silent",
    simulate: "preview",
    write: "confirm",
    auto_approve_below_usd: 50,
  };

  it("amountUsd = 20 below threshold + write → preview (downgraded)", async () => {
    const wallet = await freshWallet(POLICY_WITH_THRESHOLD);
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
      20,
    );
    assert.equal(treatment, "preview");
  });

  it("amountUsd = 100 above threshold + write → confirm (no downgrade)", async () => {
    const wallet = await freshWallet(POLICY_WITH_THRESHOLD);
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
      100,
    );
    assert.equal(treatment, "confirm");
  });

  it("amountUsd exactly at threshold (50) + write → confirm (strict <)", async () => {
    const wallet = await freshWallet(POLICY_WITH_THRESHOLD);
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
      50,
    );
    assert.equal(treatment, "confirm");
  });

  it("amountUsd undefined + threshold configured + write → confirm", async () => {
    const wallet = await freshWallet(POLICY_WITH_THRESHOLD);
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "confirm");
  });
});

describe("resolveUXTreatment — policy is the fallback even with a `once` grant", () => {
  it("stored `once` grant + watch-only wallet → still blocked", async () => {
    const wallet = await freshWallet(WATCH_ONLY_POLICY);
    // A stored `once` grant is semantically identical to no grant;
    // resolveGrant() returns `{ type: "once" }` and we must fall back
    // to the policy, which blocks watch-only writes.
    wallet.grantStore.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "once" },
      wallet_address: WALLET,
      granted_at: Date.now(),
    });
    const treatment = resolveUXTreatment(
      "write",
      "send_native_token",
      wallet,
      SESSION_ID,
    );
    assert.equal(treatment, "blocked");
  });
});

describe("resolveFromPolicy — unit coverage of the pure helper", () => {
  it("tool override wins over the capability base", () => {
    const policy: ApprovalPolicy = {
      read: "silent",
      simulate: "preview",
      write: "confirm",
      tool_overrides: { magic_tool: "silent" },
    };
    assert.equal(resolveFromPolicy(policy, "write", "magic_tool"), "silent");
  });

  it("returns the capability base when no override matches", () => {
    const policy: ApprovalPolicy = {
      read: "silent",
      simulate: "preview",
      write: "confirm",
      tool_overrides: { other_tool: "silent" },
    };
    assert.equal(
      resolveFromPolicy(policy, "simulate", "magic_tool"),
      "preview",
    );
  });

  it("does NOT downgrade non-confirm bases via auto_approve_below_usd", () => {
    // `preview` should stay `preview` — the downgrade only applies when
    // the base is `confirm`. Otherwise small-value reads would get
    // needlessly shuffled to `preview` which has no effect.
    const policy: ApprovalPolicy = {
      read: "silent",
      simulate: "preview",
      write: "preview",
      auto_approve_below_usd: 50,
    };
    assert.equal(
      resolveFromPolicy(policy, "write", "send_native_token", 10),
      "preview",
    );
  });
});

// --- Per-token transfer thresholds ----------------------------------------

describe("resolveFromPolicy with transfer thresholds", () => {
  const baseHot: ApprovalPolicy = {
    read: "silent",
    simulate: "preview",
    write: "confirm",
  };

  it("uses native default when transferring native and no override exists", () => {
    // $3 < $5 default → preview
    assert.equal(
      resolveFromPolicy(
        baseHot,
        "write",
        "send_native_token",
        3,
        {
          default_native_usd: 5,
          default_token_usd: 25,
          overrides: {},
        },
        { chainId: 1, contractAddressOrNative: "native", isNative: true },
      ),
      "preview",
    );
  });

  it("uses token default when transferring ERC-20 and no override exists", () => {
    // $20 < $25 default → preview
    assert.equal(
      resolveFromPolicy(
        baseHot,
        "write",
        "transfer_erc20",
        20,
        {
          default_native_usd: 5,
          default_token_usd: 25,
          overrides: {},
        },
        {
          chainId: 1,
          contractAddressOrNative: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          isNative: false,
        },
      ),
      "preview",
    );
  });

  it("per-token override beats the default (whitelist scenario)", () => {
    // Default = $0 (always ask) but USDC has a $200 override
    const policy = baseHot;
    const treatment = resolveFromPolicy(
      policy,
      "write",
      "transfer_erc20",
      150, // below the override
      {
        default_native_usd: 0,
        default_token_usd: 0,
        overrides: {
          "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
            chainId: 1,
            contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            symbol: "USDC",
            isNative: false,
            threshold_usd: 200,
          },
        },
      },
      {
        chainId: 1,
        contractAddressOrNative: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        isNative: false,
      },
    );
    assert.equal(treatment, "preview");
  });

  it("per-token override of 0 forces always-ask (blacklist scenario)", () => {
    // Token default would auto-approve $20, but USDC override = $0
    const treatment = resolveFromPolicy(
      baseHot,
      "write",
      "transfer_erc20",
      20,
      {
        default_native_usd: 5,
        default_token_usd: 100,
        overrides: {
          "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
            chainId: 1,
            contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            symbol: "USDC",
            isNative: false,
            threshold_usd: 0,
          },
        },
      },
      {
        chainId: 1,
        contractAddressOrNative: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        isNative: false,
      },
    );
    assert.equal(treatment, "confirm");
  });

  it("amount equal to threshold falls through to confirm (strict less-than)", () => {
    assert.equal(
      resolveFromPolicy(
        baseHot,
        "write",
        "send_native_token",
        25, // == threshold, not <
        {
          default_native_usd: 25,
          default_token_usd: 50,
          overrides: {},
        },
        { chainId: 1, contractAddressOrNative: "native", isNative: true },
      ),
      "confirm",
    );
  });

  it("falls back to legacy auto_approve_below_usd when no thresholds passed", () => {
    // No thresholds + legacy field set → legacy path runs
    const policy: ApprovalPolicy = {
      ...baseHot,
      auto_approve_below_usd: 50,
    };
    assert.equal(
      resolveFromPolicy(policy, "write", "send_native_token", 10),
      "preview",
    );
  });

  it("threshold path overrides legacy field when both are configured", () => {
    // Legacy says auto-approve below $100, but new thresholds say $5 native.
    // $50 < $100 (legacy would preview) but $50 > $5 (thresholds say confirm)
    // → thresholds win.
    const policy: ApprovalPolicy = {
      ...baseHot,
      auto_approve_below_usd: 100,
    };
    assert.equal(
      resolveFromPolicy(
        policy,
        "write",
        "send_native_token",
        50,
        {
          default_native_usd: 5,
          default_token_usd: 25,
          overrides: {},
        },
        { chainId: 1, contractAddressOrNative: "native", isNative: true },
      ),
      "confirm",
    );
  });
});

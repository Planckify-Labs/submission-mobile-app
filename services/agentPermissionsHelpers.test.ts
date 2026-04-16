/**
 * Unit tests for the `agentPermissionsHelpers` module and the round-trip
 * behaviour of the "Always ask" default-mode override through
 * `resolveUXTreatment()`.
 *
 * Run from the mobile-app root with:
 *
 *     node --test --experimental-strip-types services/agentPermissionsHelpers.test.ts
 *
 * The tests share the same in-memory `GrantStorageAdapter` pattern as
 * the task 11 / task 12 test files so they never touch native modules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeCurrentMode,
  formatLifetimeLabel,
  formatScopeLabel,
  listRenderableGrants,
} from "./agentPermissionsHelpers.ts";
import {
  type GrantStorageAdapter,
  type PermissionGrant,
  PermissionGrantStore,
} from "./permissionGrantStore.ts";
import {
  type ConnectedWallet,
  HOT_WALLET_POLICY,
  resolveUXTreatment,
} from "./resolveUxTreatment.ts";

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const SESSION_ID = "a1b2c3d4-xyz";

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

async function freshStore(
  wallet: `0x${string}`,
): Promise<PermissionGrantStore> {
  const s = new PermissionGrantStore(wallet, makeMemoryAdapter());
  await s.whenLoaded();
  return s;
}

async function freshWallet(wallet: `0x${string}`): Promise<ConnectedWallet> {
  return {
    address: wallet,
    approvalPolicy: HOT_WALLET_POLICY,
    grantStore: await freshStore(wallet),
  };
}

// --- formatScopeLabel ------------------------------------------------------

describe("formatScopeLabel", () => {
  it("tool scope returns the tool key verbatim", () => {
    assert.equal(
      formatScopeLabel({ kind: "tool", key: "send_native_token" }),
      "send_native_token",
    );
  });

  it("capability scope renders as user-facing category labels", () => {
    assert.equal(
      formatScopeLabel({ kind: "capability", key: "write" }),
      "Write actions",
    );
    assert.equal(
      formatScopeLabel({ kind: "capability", key: "read" }),
      "Read actions",
    );
    assert.equal(
      formatScopeLabel({ kind: "capability", key: "simulate" }),
      "Simulate actions",
    );
  });

  it("global scope renders as 'All actions'", () => {
    assert.equal(formatScopeLabel({ kind: "global" }), "All actions");
  });
});

// --- formatLifetimeLabel ---------------------------------------------------

describe("formatLifetimeLabel", () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0);
  const granted = Date.UTC(2026, 0, 10, 9, 0, 0);

  it("session → 'Session' + session id prefix", () => {
    const label = formatLifetimeLabel(
      { type: "session", session_id: "a1b2c3d4-xyz" },
      now,
      granted,
    );
    assert.equal(label.primary, "Session");
    assert.equal(label.secondary, "session #a1b2");
  });

  it("timed with one hour remaining → '1 hour' + expiry time", () => {
    const expires = now + 60 * 60 * 1000;
    const label = formatLifetimeLabel(
      { type: "timed", expires_at: expires },
      now,
      granted,
    );
    assert.equal(label.primary, "1 hour");
    assert.ok(label.secondary.startsWith("expires "));
  });

  it("timed with several hours → 'N hours' (plural)", () => {
    const expires = now + 3 * 60 * 60 * 1000;
    const label = formatLifetimeLabel(
      { type: "timed", expires_at: expires },
      now,
      granted,
    );
    assert.equal(label.primary, "3 hours");
  });

  it("timed with <1h remaining → rounded minutes", () => {
    const expires = now + 10 * 60 * 1000;
    const label = formatLifetimeLabel(
      { type: "timed", expires_at: expires },
      now,
      granted,
    );
    assert.equal(label.primary, "10 minutes");
  });

  it("permanent → 'Always' + granted date", () => {
    const label = formatLifetimeLabel({ type: "permanent" }, now, granted);
    assert.equal(label.primary, "Always");
    assert.ok(label.secondary.startsWith("granted "));
  });

  it("always_ask → 'Always ask' + override note", () => {
    const label = formatLifetimeLabel({ type: "always_ask" }, now, granted);
    assert.equal(label.primary, "Always ask");
    assert.equal(label.secondary, "override");
  });

  it("once is defensively rendered (should never be persisted though)", () => {
    const label = formatLifetimeLabel({ type: "once" }, now, granted);
    assert.equal(label.primary, "Once");
  });
});

// --- computeCurrentMode ----------------------------------------------------

describe("computeCurrentMode", () => {
  it("empty store → 'agent_decides'", () => {
    assert.equal(computeCurrentMode([]), "agent_decides");
  });

  it("global permanent → 'full_auto'", () => {
    const grants: PermissionGrant[] = [
      {
        scope: { kind: "global" },
        lifetime: { type: "permanent" },
        wallet_address: WALLET_A,
        granted_at: Date.now(),
      },
    ];
    assert.equal(computeCurrentMode(grants), "full_auto");
  });

  it("global always_ask → 'always_ask'", () => {
    const grants: PermissionGrant[] = [
      {
        scope: { kind: "global" },
        lifetime: { type: "always_ask" },
        wallet_address: WALLET_A,
        granted_at: Date.now(),
      },
    ];
    assert.equal(computeCurrentMode(grants), "always_ask");
  });

  it("always_ask wins over a concurrently-present permanent grant", () => {
    // Both rows exist in the store (we haven't revoked them), but the
    // user toggled the mode to "always_ask" on top. The selector must
    // reflect "always_ask" since that's what resolveGrant actually does.
    const grants: PermissionGrant[] = [
      {
        scope: { kind: "global" },
        lifetime: { type: "permanent" },
        wallet_address: WALLET_A,
        granted_at: Date.now(),
      },
      {
        scope: { kind: "global" },
        lifetime: { type: "always_ask" },
        wallet_address: WALLET_A,
        granted_at: Date.now(),
      },
    ];
    assert.equal(computeCurrentMode(grants), "always_ask");
  });

  it("only tool-level grants present → still 'agent_decides'", () => {
    const grants: PermissionGrant[] = [
      {
        scope: { kind: "tool", key: "send_native_token" },
        lifetime: { type: "permanent" },
        wallet_address: WALLET_A,
        granted_at: Date.now(),
      },
    ];
    assert.equal(computeCurrentMode(grants), "agent_decides");
  });
});

// --- listRenderableGrants --------------------------------------------------

describe("listRenderableGrants", () => {
  it("drops stray `once` entries", () => {
    const grants: PermissionGrant[] = [
      {
        scope: { kind: "tool", key: "send_native_token" },
        lifetime: { type: "permanent" },
        wallet_address: WALLET_A,
        granted_at: 1,
      },
      {
        scope: { kind: "tool", key: "read_contract" },
        lifetime: { type: "once" },
        wallet_address: WALLET_A,
        granted_at: 2,
      },
    ];
    const out = listRenderableGrants(grants);
    assert.equal(out.length, 1);
    assert.equal(out[0].scope.kind, "tool");
    assert.equal((out[0].scope as { key: string }).key, "send_native_token");
  });

  it("returns a fresh array (no aliasing)", () => {
    const grants: PermissionGrant[] = [];
    const out = listRenderableGrants(grants);
    assert.notEqual(out, grants);
  });
});

// --- grantStore integration: list / remove / prune / revokeAll -----------

describe("grantStore integration (backing the UI)", () => {
  it("list() exposes all active grants for the wallet (and hides `once`)", async () => {
    const store = await freshStore(WALLET_A);
    const now = Date.now();
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "timed", expires_at: now + 60_000 },
      wallet_address: WALLET_A,
      granted_at: now,
    });
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "session", session_id: SESSION_ID },
      wallet_address: WALLET_A,
      granted_at: now,
    });
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: now,
    });
    const visible = listRenderableGrants(store.list(WALLET_A));
    assert.equal(visible.length, 3);
  });

  it("remove() drops the row from list() immediately", async () => {
    const store = await freshStore(WALLET_A);
    const now = Date.now();
    const toolGrant: PermissionGrant = {
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: now,
    };
    store.add(toolGrant);
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: now,
    });
    assert.equal(store.list(WALLET_A).length, 2);
    store.remove(toolGrant);
    assert.equal(store.list(WALLET_A).length, 1);
    assert.equal(store.list(WALLET_A)[0].scope.kind, "capability");
  });

  it("prune() removes expired timed grants before rendering", async () => {
    const store = await freshStore(WALLET_A);
    // Already expired.
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "timed", expires_at: Date.now() - 1 },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.prune();
    const listed = store.list(WALLET_A);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].scope.kind, "global");
  });

  it("revokeAll() empties the store", async () => {
    const store = await freshStore(WALLET_A);
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.revokeAll(WALLET_A);
    assert.equal(store.list(WALLET_A).length, 0);
  });

  it("switching wallets exposes only that wallet's grants", async () => {
    const storeA = await freshStore(WALLET_A);
    const storeB = await freshStore(WALLET_B);

    storeA.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    storeB.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_B,
      granted_at: Date.now(),
    });

    assert.equal(storeA.list(WALLET_A).length, 1);
    assert.equal(storeB.list(WALLET_B).length, 1);
    // Cross-wallet list queries return nothing.
    assert.equal(storeA.list(WALLET_B).length, 0);
    assert.equal(storeB.list(WALLET_A).length, 0);
  });
});

// --- The round-trip acceptance criterion -----------------------------------

describe("default-mode round trip through resolveUXTreatment", () => {
  it("'Always ask' mode correctly overrides a pre-existing 'Full auto' permanent grant", async () => {
    const wallet = await freshWallet(WALLET_A);

    // Step 1: user was in "Full auto" mode — a global permanent grant
    // is sitting in the store.
    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });

    // Sanity: with only the permanent grant, a write should be silent.
    assert.equal(
      resolveUXTreatment("write", "send_native_token", wallet, SESSION_ID),
      "silent",
    );

    // Step 2: user switches default mode to "Always ask". Per §6, the
    // screen installs an `always_ask` grant on the global scope. It does
    // NOT automatically delete the existing permanent grant — the
    // acceptance criterion is that `always_ask` still wins via
    // resolveGrant's hard override.
    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "always_ask" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });

    // Because `PermissionGrantStore.add()` upserts by scope, the two
    // global grants collapse into one — verify.
    const globals = wallet.grantStore
      .list(WALLET_A)
      .filter((g) => g.scope.kind === "global");
    assert.equal(globals.length, 1);
    assert.equal(globals[0].lifetime.type, "always_ask");

    // Round trip: resolveUXTreatment must now return `confirm`, not
    // `silent`. This is the single test the task spec calls out by
    // name.
    assert.equal(
      resolveUXTreatment("write", "send_native_token", wallet, SESSION_ID),
      "confirm",
    );

    // And computeCurrentMode must reflect the change.
    assert.equal(
      computeCurrentMode(wallet.grantStore.list(WALLET_A)),
      "always_ask",
    );
  });

  it("'Full auto' mode enables silent writes after installing the permanent global grant", async () => {
    const wallet = await freshWallet(WALLET_A);
    assert.equal(
      resolveUXTreatment("write", "send_native_token", wallet, SESSION_ID),
      "confirm", // hot wallet default
    );

    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });

    assert.equal(
      resolveUXTreatment("write", "send_native_token", wallet, SESSION_ID),
      "silent",
    );
    assert.equal(
      computeCurrentMode(wallet.grantStore.list(WALLET_A)),
      "full_auto",
    );
  });

  it("'Agent decides' mode (empty store) falls through to the wallet policy", async () => {
    const wallet = await freshWallet(WALLET_A);
    // Seed something, then revoke all — this is the "Agent decides"
    // transition path from either of the other two modes.
    wallet.grantStore.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    wallet.grantStore.revokeAll(WALLET_A);
    assert.equal(wallet.grantStore.list(WALLET_A).length, 0);
    assert.equal(
      resolveUXTreatment("write", "send_native_token", wallet, SESSION_ID),
      "confirm",
    );
    assert.equal(
      computeCurrentMode(wallet.grantStore.list(WALLET_A)),
      "agent_decides",
    );
  });
});

/**
 * Unit tests for `PermissionGrantStore` and `resolveGrant()`.
 *
 * The mobile-app repo does not ship a test framework, so these tests use
 * Node's built-in `node:test` runner with type stripping. Run from the
 * mobile-app root with:
 *
 *     node --test --experimental-strip-types services/permissionGrantStore.test.ts
 *
 * The tests mock `expo-secure-store` via a tiny in-memory `GrantStorageAdapter`
 * so nothing from the native runtime is required.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  type GrantStorageAdapter,
  type PermissionGrant,
  PermissionGrantStore,
  resolveGrant,
} from "./permissionGrantStore.ts";

const WALLET_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const WALLET_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const SESSION_ID = "session-123";

function makeMemoryAdapter(): GrantStorageAdapter & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
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

async function freshStore(adapter?: GrantStorageAdapter) {
  const a = adapter ?? makeMemoryAdapter();
  const s = new PermissionGrantStore(WALLET_A, a);
  await s.whenLoaded();
  return { store: s, adapter: a };
}

describe("resolveGrant — lifetime coverage", () => {
  let store: PermissionGrantStore;

  beforeEach(async () => {
    const res = await freshStore();
    store = res.store;
  });

  it("returns `once` when no grants are stored", () => {
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "once" });
  });

  it("resolves `always_ask` correctly", () => {
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "always_ask" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "always_ask" });
  });

  it("resolves `permanent` correctly", () => {
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "permanent" });
  });

  it("resolves `session` grant only when session_id matches", () => {
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "session", session_id: SESSION_ID },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const matched = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(matched, { type: "session", session_id: SESSION_ID });

    const mismatched = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      "different-session",
      store,
    );
    assert.deepEqual(mismatched, { type: "once" });
  });

  it("resolves `timed` grant only while not expired", () => {
    const expiresAt = Date.now() + 60_000;
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "timed", expires_at: expiresAt },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "timed", expires_at: expiresAt });
  });

  it("stored `once` grant behaves like no grant (falls through)", () => {
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "once" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "once" });
  });
});

describe("resolveGrant — priority ordering", () => {
  it("tool-level grant wins over capability-level grant", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "timed", expires_at: Date.now() + 60_000 },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.equal(result.type, "timed");
  });

  it("capability-level grant wins over global grant", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "timed", expires_at: Date.now() + 60_000 },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.equal(result.type, "timed");
  });

  it("`always_ask` at tool level overrides a global permanent grant", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "always_ask" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "always_ask" });
  });
});

describe("resolveGrant — deny-overrides-allow (the Never rule)", () => {
  it("a tool-level always_deny resolves to always_deny", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "always_deny" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "always_deny" });
  });

  it("a capability-level always_deny (Write→Never) beats a tool-level Auto grant", async () => {
    const { store } = await freshStore();
    // Per-tool Auto…
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    // …but the write capability is blocked. Deny must win regardless of
    // the tool > capability > global priority.
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "always_deny" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "always_deny" });
  });

  it("a global always_deny beats a tool-level always_ask", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "always_ask" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "global" },
      lifetime: { type: "always_deny" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "always_deny" });
  });

  it("notifies subscribers on add", async () => {
    const { store } = await freshStore();
    let fired = 0;
    const unsub = store.subscribe(() => {
      fired += 1;
    });
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "always_deny" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    assert.ok(fired >= 1, "subscriber should fire on add");
    unsub();
  });
});

describe("PermissionGrantStore — pruning and scoping", () => {
  it("prunes expired timed grants on find()", async () => {
    const { store } = await freshStore();
    const expired: PermissionGrant = {
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "timed", expires_at: Date.now() - 1_000 },
      wallet_address: WALLET_A,
      granted_at: Date.now() - 10_000,
    };
    store.add(expired);

    const found = store.find({
      scope: { kind: "capability", key: "write" },
      wallet: WALLET_A,
    });
    assert.equal(found, undefined);
    // Confirm the stale grant is gone from the list too.
    assert.equal(store.list(WALLET_A).length, 0);
  });

  it("also prunes expired grants via resolveGrant() miss", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "timed", expires_at: Date.now() - 1 },
      wallet_address: WALLET_A,
      granted_at: Date.now() - 10_000,
    });
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.deepEqual(result, { type: "once" });
  });

  it("a grant for wallet A does not resolve for wallet B", async () => {
    const { store: storeA } = await freshStore();
    storeA.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    // Same store instance cannot serve wallet B.
    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_B,
      SESSION_ID,
      storeA,
    );
    assert.deepEqual(result, { type: "once" });
    assert.equal(storeA.list(WALLET_B).length, 0);
  });

  it("revokeAll() wipes all grants for the wallet", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    store.add({
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    assert.equal(store.list(WALLET_A).length, 2);
    store.revokeAll(WALLET_A);
    assert.equal(store.list(WALLET_A).length, 0);
  });

  it("add() is an upsert — scope collisions replace the prior grant", async () => {
    const { store } = await freshStore();
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "timed", expires_at: Date.now() + 60_000 },
      wallet_address: WALLET_A,
      granted_at: 1,
    });
    store.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: 2,
    });
    const list = store.list(WALLET_A);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.lifetime.type, "permanent");
  });
});

describe("PermissionGrantStore — persistence", () => {
  it("persists across reloads into a fresh instance", async () => {
    const adapter = makeMemoryAdapter();
    const first = new PermissionGrantStore(WALLET_A, adapter);
    await first.whenLoaded();

    first.add({
      scope: { kind: "tool", key: "send_native_token" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    await first.flushed();

    const second = new PermissionGrantStore(WALLET_A, adapter);
    await second.whenLoaded();

    const found = second.find({
      scope: { kind: "tool", key: "send_native_token" },
      wallet: WALLET_A,
    });
    assert.ok(found, "grant should have been reloaded");
    assert.equal(found?.lifetime.type, "permanent");
  });

  it("persists removals across reloads", async () => {
    const adapter = makeMemoryAdapter();
    const first = new PermissionGrantStore(WALLET_A, adapter);
    await first.whenLoaded();
    const grant: PermissionGrant = {
      scope: { kind: "capability", key: "write" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    };
    first.add(grant);
    await first.flushed();
    first.remove(grant);
    await first.flushed();

    const second = new PermissionGrantStore(WALLET_A, adapter);
    await second.whenLoaded();
    assert.equal(second.list(WALLET_A).length, 0);
  });

  it("persists different wallets under different storage keys", async () => {
    const adapter = makeMemoryAdapter();
    const storeA = new PermissionGrantStore(WALLET_A, adapter);
    const storeB = new PermissionGrantStore(WALLET_B, adapter);
    await storeA.whenLoaded();
    await storeB.whenLoaded();

    storeA.add({
      scope: { kind: "global" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: Date.now(),
    });
    await storeA.flushed();
    await storeB.flushed();

    // Reload both from the shared adapter.
    const reloadedA = new PermissionGrantStore(WALLET_A, adapter);
    const reloadedB = new PermissionGrantStore(WALLET_B, adapter);
    await reloadedA.whenLoaded();
    await reloadedB.whenLoaded();

    assert.equal(reloadedA.list(WALLET_A).length, 1);
    assert.equal(reloadedB.list(WALLET_B).length, 0);
  });
});

describe("PermissionGrantStore — simulate-capability migration", () => {
  it("drops legacy `simulate` capability grants on load and re-persists clean", async () => {
    const adapter = makeMemoryAdapter();

    // Discover the storage key the store uses for this wallet by letting a
    // throwaway instance persist once — avoids coupling the test to the
    // (private) key-prefix format.
    const seeder = new PermissionGrantStore(WALLET_A, adapter);
    await seeder.whenLoaded();
    seeder.add({
      scope: { kind: "capability", key: "read" },
      lifetime: { type: "permanent" },
      wallet_address: WALLET_A,
      granted_at: 2,
    });
    await seeder.flushed();
    const [storageKey] = [...adapter.store.keys()];
    assert.ok(storageKey, "store should have written under a key");

    // Inject a blob shaped like one written by the OLD app version, where a
    // `{ kind: "capability", key: "simulate" }` grant was still creatable.
    const legacyBlob = JSON.stringify([
      {
        scope: { kind: "capability", key: "simulate" },
        lifetime: { type: "permanent" },
        wallet_address: WALLET_A,
        granted_at: 1,
      },
      {
        scope: { kind: "capability", key: "read" },
        lifetime: { type: "permanent" },
        wallet_address: WALLET_A,
        granted_at: 2,
      },
    ]);
    adapter.store.set(storageKey, legacyBlob);

    // Loading a fresh store should strip the dead simulate grant...
    const store = new PermissionGrantStore(WALLET_A, adapter);
    await store.whenLoaded();
    await store.flushed();

    const live = store.list(WALLET_A);
    assert.equal(live.length, 1, "only the read grant should survive");
    assert.equal(live[0].scope.kind, "capability");
    assert.equal((live[0].scope as { key: string }).key, "read");

    // ...and the cleaned set must be written back so the stale entry is gone
    // for good, not re-filtered in memory on every launch.
    const persisted = adapter.store.get(storageKey);
    assert.ok(persisted, "cleaned grants should be persisted");
    assert.ok(
      !persisted.includes('"simulate"'),
      "persisted blob must no longer contain the simulate grant",
    );
  });
});

describe("PermissionGrantStore — factories", () => {
  it("conservative() yields an empty store", async () => {
    const adapter = makeMemoryAdapter();
    const store = PermissionGrantStore.conservative(WALLET_A, adapter);
    await store.whenLoaded();
    assert.equal(store.list(WALLET_A).length, 0);
  });

  it("autonomous() seeds a global permanent grant", async () => {
    const adapter = makeMemoryAdapter();
    const store = PermissionGrantStore.autonomous(WALLET_A, adapter);
    await store.whenLoaded();

    const result = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      store,
    );
    assert.equal(result.type, "permanent");

    // And it survives a reload — the seed is persisted.
    await store.flushed();
    const reloaded = new PermissionGrantStore(WALLET_A, adapter);
    await reloaded.whenLoaded();
    const reloadedResult = resolveGrant(
      "send_native_token",
      "write",
      WALLET_A,
      SESSION_ID,
      reloaded,
    );
    assert.equal(reloadedResult.type, "permanent");
  });
});

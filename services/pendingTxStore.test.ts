/**
 * Unit tests for `pendingTxStore`.
 *
 * Follows the same pattern as `services/permissionGrantStore.test.ts`:
 * Node's built-in `node:test` runner with type stripping. Run from
 * the mobile-app root:
 *
 *     node --test --experimental-strip-types services/pendingTxStore.test.ts
 *
 * The store is a module-level singleton, so every test hard-resets
 * via `__testing.reset()` in `beforeEach`.
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  __testing,
  type PendingTxRecord,
  pendingTxStore,
} from "./pendingTxStore.ts";

const HASH_A =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const HASH_B =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

beforeEach(() => {
  __testing.reset();
});

describe("pendingTxStore — add/list", () => {
  it("add() → list() returns a submitted record", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 137,
      description: "Send 1 MATIC to 0xabc",
    });
    const list = pendingTxStore.list();
    assert.equal(list.length, 1);
    const entry = list[0]!;
    assert.equal(entry.tx_hash, HASH_A);
    assert.equal(entry.chain_id, 137);
    assert.equal(entry.description, "Send 1 MATIC to 0xabc");
    assert.equal(entry.state, "submitted");
    assert.equal(typeof entry.submitted_at, "number");
    assert.equal(entry.confirmed_at, undefined);
    assert.equal(entry.block_number, undefined);
    assert.equal(entry.error, undefined);
  });

  it("add() accepts a terminal `failed` state for reverted-before-submit", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "Swap",
      state: "failed",
      error: "execution reverted: slippage",
    });
    const entry = pendingTxStore.get(HASH_A);
    assert.ok(entry);
    assert.equal(entry.state, "failed");
    assert.equal(entry.error, "execution reverted: slippage");
  });

  it("add() is case-insensitive on tx_hash", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "First",
    });
    // Lookup via an uppercased variant still finds the same record.
    const found = pendingTxStore.get(HASH_A.toUpperCase());
    assert.ok(found);
    assert.equal(found.description, "First");
  });

  it("add() with duplicate submitted hash does not clobber existing record", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "First",
    });
    const firstSubmitted = pendingTxStore.get(HASH_A)?.submitted_at;
    // Simulate a reconnect re-run.
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "Second (should be ignored)",
    });
    const entry = pendingTxStore.get(HASH_A);
    assert.ok(entry);
    assert.equal(entry.description, "First");
    assert.equal(entry.submitted_at, firstSubmitted);
  });

  it("list() sorts newest-first by submitted_at", async () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "older",
    });
    // Tiny wait so the two timestamps are guaranteed distinct.
    await new Promise((r) => setTimeout(r, 2));
    pendingTxStore.add({
      tx_hash: HASH_B,
      chain_id: 1,
      description: "newer",
    });
    const list = pendingTxStore.list();
    assert.equal(list.length, 2);
    assert.equal(list[0]!.tx_hash, HASH_B);
    assert.equal(list[1]!.tx_hash, HASH_A);
  });
});

describe("pendingTxStore — markConfirmed", () => {
  it("updates state, confirmed_at, block_number", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "Confirm me",
    });
    pendingTxStore.markConfirmed(HASH_A, 12345);
    const entry = pendingTxStore.get(HASH_A);
    assert.ok(entry);
    assert.equal(entry.state, "confirmed");
    assert.equal(entry.block_number, 12345);
    assert.equal(typeof entry.confirmed_at, "number");
    assert.equal(entry.error, undefined);
  });

  it("is a no-op for unknown tx_hash (does not throw)", () => {
    // Must not throw.
    pendingTxStore.markConfirmed(HASH_B, 9999);
    assert.equal(pendingTxStore.list().length, 0);
  });

  it("case-insensitive lookup", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "x",
    });
    pendingTxStore.markConfirmed(HASH_A.toUpperCase(), 10);
    const entry = pendingTxStore.get(HASH_A);
    assert.ok(entry);
    assert.equal(entry.state, "confirmed");
    assert.equal(entry.block_number, 10);
  });
});

describe("pendingTxStore — markFailed", () => {
  it("updates state and error verbatim", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "Fail me",
    });
    pendingTxStore.markFailed(HASH_A, "Transaction reverted");
    const entry = pendingTxStore.get(HASH_A);
    assert.ok(entry);
    assert.equal(entry.state, "failed");
    assert.equal(entry.error, "Transaction reverted");
  });

  it("does not downgrade a confirmed record", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "Already confirmed",
    });
    pendingTxStore.markConfirmed(HASH_A, 1);
    pendingTxStore.markFailed(HASH_A, "should be ignored");
    const entry = pendingTxStore.get(HASH_A);
    assert.ok(entry);
    assert.equal(entry.state, "confirmed");
  });

  it("is a no-op for unknown tx_hash", () => {
    pendingTxStore.markFailed(HASH_B, "does-not-matter");
    assert.equal(pendingTxStore.list().length, 0);
  });
});

describe("pendingTxStore — subscribe", () => {
  it("fires immediately on subscribe, then on every mutation", () => {
    const seen: PendingTxRecord[][] = [];
    const unsubscribe = pendingTxStore.subscribe((records) => {
      seen.push(records);
    });
    // Initial prime.
    assert.equal(seen.length, 1);
    assert.equal(seen[0]!.length, 0);

    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "x",
    });
    assert.equal(seen.length, 2);
    assert.equal(seen[1]!.length, 1);

    pendingTxStore.markConfirmed(HASH_A, 42);
    assert.equal(seen.length, 3);
    assert.equal(seen[2]![0]!.state, "confirmed");

    unsubscribe();
  });

  it("unsubscribe() stops further notifications", () => {
    let calls = 0;
    const unsubscribe = pendingTxStore.subscribe(() => {
      calls += 1;
    });
    // The prime counts as 1.
    assert.equal(calls, 1);

    unsubscribe();

    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "x",
    });
    // Still 1 — the unsubscribed listener must not fire.
    assert.equal(calls, 1);
    assert.equal(__testing.listenerCount(), 0);
  });

  it("clear() emits to subscribers", () => {
    pendingTxStore.add({
      tx_hash: HASH_A,
      chain_id: 1,
      description: "x",
    });
    const seen: number[] = [];
    const unsubscribe = pendingTxStore.subscribe((records) => {
      seen.push(records.length);
    });
    // Prime saw the single record.
    assert.deepEqual(seen, [1]);
    pendingTxStore.clear();
    assert.deepEqual(seen, [1, 0]);
    unsubscribe();
  });
});

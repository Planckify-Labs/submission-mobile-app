/**
 * Unit tests for `X402SpendLedger` (spec Phase 5 §8 — ledger math &
 * budget gate). Run under `node:test` via `pnpm test:node`.
 */

import { strict as a } from "node:assert";
import { test } from "node:test";
import { type SpendStorageAdapter, X402SpendLedger } from "./budget.ts";

function memAdapter(): SpendStorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async getItem(k) {
      return store.get(k) ?? null;
    },
    async setItem(k, v) {
      store.set(k, v);
    },
    async deleteItem(k) {
      store.delete(k);
    },
  };
}

const WALLET = "0x000000000000000000000000000000000000bEEF";
const SALT = "0x01";

test("remaining = cap - spent and never negative", async () => {
  const adapter = memAdapter();
  const ledger = new X402SpendLedger(WALLET, SALT, adapter);
  await ledger.whenLoaded();
  a.equal(ledger.remaining(5_000_000n), 5_000_000n);
  ledger.record(20_000n);
  a.equal(ledger.getSpent(), 20_000n);
  a.equal(ledger.remaining(5_000_000n), 4_980_000n);
  ledger.record(10_000_000n); // overspend the local cap
  a.equal(ledger.remaining(5_000_000n), 0n);
});

test("accumulated spend survives a JSON round-trip (decimal strings)", async () => {
  const adapter = memAdapter();
  const first = new X402SpendLedger(WALLET, SALT, adapter);
  await first.whenLoaded();
  first.record(20_000n);
  first.record(750_000n);
  await first.flushed();

  const second = new X402SpendLedger(WALLET, SALT, adapter);
  await second.whenLoaded();
  a.equal(second.getSpent(), 770_000n);
  // Persisted value is a plain decimal string (bigint is not JSON-safe).
  const raw = adapter.store.get([...adapter.store.keys()][0]);
  a.ok(raw && raw.includes('"770000"'));
});

test("is scoped per (wallet, salt) — no cross-bleed", async () => {
  const adapter = memAdapter();
  const a1 = new X402SpendLedger(WALLET, "0xAA", adapter);
  const a2 = new X402SpendLedger(WALLET, "0xBB", adapter);
  await Promise.all([a1.whenLoaded(), a2.whenLoaded()]);
  a1.record(100_000n);
  await a1.flushed();
  a.equal(a2.getSpent(), 0n);

  const other = new X402SpendLedger("0xdeadbeef", "0xAA", adapter);
  await other.whenLoaded();
  a.equal(other.getSpent(), 0n);
});

test("periodic allowance caps against periodAmount and resets each period", async () => {
  const adapter = memAdapter();
  let now = 1_000_000; // unix seconds
  const ledger = new X402SpendLedger(WALLET, SALT, adapter, {
    period: { periodAmount: 10_000_000n, periodDurationSec: 604_800 },
    nowSec: () => now,
  });
  await ledger.whenLoaded();
  a.equal(ledger.remaining(999n), 10_000_000n); // cap arg ignored when periodic
  ledger.record(4_000_000n);
  a.equal(ledger.remaining(0n), 6_000_000n);

  // Within the same window — still accrues.
  now += 100;
  ledger.record(1_000_000n);
  a.equal(ledger.remaining(0n), 5_000_000n);

  // After the window rolls over — resets to the full period amount.
  now += 604_800;
  a.equal(ledger.remaining(0n), 10_000_000n);
  a.equal(ledger.getSpent(), 0n);
});

test("record ignores non-positive amounts", async () => {
  const adapter = memAdapter();
  const ledger = new X402SpendLedger(WALLET, SALT, adapter);
  await ledger.whenLoaded();
  ledger.record(0n);
  ledger.record(-5n);
  a.equal(ledger.getSpent(), 0n);
});

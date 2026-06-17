import { describe, expect, it } from "vitest";
import type { Intent } from "./intentSchema";
import { INTENT_TTL_MS, IntentStoreImpl } from "./intentStore";

const intent: Intent = {
  action: "swap",
  fromAsset: "SUI",
  toAsset: "USDC",
  amount: { human: "5" },
  maxSlippageBps: 50,
};

function put(store: IntentStoreImpl, now: number): string {
  return store.put(
    { ptbBase64: "AAA=", intent, flags: [], summary: "Swap 5 SUI to USDC" },
    now,
  );
}

describe("intentStore", () => {
  it("round-trips a stored intent by id", () => {
    const store = new IntentStoreImpl();
    const now = 1_000_000;
    const id = put(store, now);
    const entry = store.get(id, now + 1000);
    expect(entry?.ptbBase64).toBe("AAA=");
    expect(entry?.summary).toBe("Swap 5 SUI to USDC");
  });

  it("returns null for an unknown id", () => {
    const store = new IntentStoreImpl();
    expect(store.get("nope")).toBeNull();
  });

  it("expires an entry past its TTL", () => {
    const store = new IntentStoreImpl();
    const now = 1_000_000;
    const id = put(store, now);
    expect(store.get(id, now + INTENT_TTL_MS - 1)).not.toBeNull();
    expect(store.get(id, now + INTENT_TTL_MS + 1)).toBeNull();
  });

  it("delete removes an entry (a previewed PTB signs at most once)", () => {
    const store = new IntentStoreImpl();
    const now = 1_000_000;
    const id = put(store, now);
    store.delete(id);
    expect(store.get(id, now)).toBeNull();
  });

  it("issues unique ids", () => {
    const store = new IntentStoreImpl();
    const a = put(store, 1);
    const b = put(store, 1);
    expect(a).not.toBe(b);
  });
});

/**
 * Spec reference: `docs/stellar-chain-support-spec.md` §9 (test table
 * rows 4, 7 — `detectAccountFunded` 404 handling, reserve math).
 */

import { describe, expect, it } from "vitest";

import {
  BASE_RESERVE_STROOPS,
  computeMinBalanceStroops,
  detectAccountFunded,
  NEW_ACCOUNT_MIN_BALANCE_STROOPS,
} from "./accountState.ts";
import {
  HorizonRequestError,
  type StellarHorizonClient,
} from "./horizonClient.ts";

function mockHorizon(
  loadAccount: StellarHorizonClient["loadAccount"],
): StellarHorizonClient {
  return {
    horizonUrl: "https://horizon.example",
    networkPassphrase: "Test SDF Network ; September 2015",
    loadAccount,
    submitTransaction: async () => ({ hash: "unused" }),
  };
}

describe("computeMinBalanceStroops", () => {
  it("is 2 base reserves for a brand-new account with 0 subentries", () => {
    const min = computeMinBalanceStroops({
      account_id: "G...",
      sequence: "1",
      subentry_count: 0,
      balances: [],
    });
    expect(min).toBe(NEW_ACCOUNT_MIN_BALANCE_STROOPS);
    expect(min).toBe(2n * BASE_RESERVE_STROOPS);
  });

  it("adds one base reserve per subentry (e.g. a trustline)", () => {
    const min = computeMinBalanceStroops({
      account_id: "G...",
      sequence: "1",
      subentry_count: 1,
      balances: [],
    });
    expect(min).toBe(3n * BASE_RESERVE_STROOPS);
  });

  it("scales linearly for many subentries", () => {
    const min = computeMinBalanceStroops({
      account_id: "G...",
      sequence: "1",
      subentry_count: 10,
      balances: [],
    });
    expect(min).toBe(12n * BASE_RESERVE_STROOPS);
  });
});

describe("detectAccountFunded", () => {
  it("returns true when loadAccount resolves", async () => {
    const horizon = mockHorizon(async () => ({
      account_id: "G...",
      sequence: "1",
      subentry_count: 0,
      balances: [],
    }));
    await expect(detectAccountFunded(horizon, "GADDRESS")).resolves.toBe(true);
  });

  it("returns false on a Horizon 404", async () => {
    const horizon = mockHorizon(async () => {
      throw new HorizonRequestError(404);
    });
    await expect(detectAccountFunded(horizon, "GADDRESS")).resolves.toBe(false);
  });

  it("rethrows on a non-404 failure (network blip, rate-limit) rather than treating it as unfunded", async () => {
    const horizon = mockHorizon(async () => {
      throw new HorizonRequestError(429);
    });
    await expect(detectAccountFunded(horizon, "GADDRESS")).rejects.toThrow(
      HorizonRequestError,
    );
  });

  it("rethrows an arbitrary thrown error (e.g. a network exception)", async () => {
    const horizon = mockHorizon(async () => {
      throw new TypeError("Network request failed");
    });
    await expect(detectAccountFunded(horizon, "GADDRESS")).rejects.toThrow(
      TypeError,
    );
  });
});

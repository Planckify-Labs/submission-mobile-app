/**
 * Spec reference: `docs/stellar-chain-support-spec.md` §9 (test table
 * row 6 — `hasTrustline` / `ensureTrustline` present vs absent vs
 * already-at-limit).
 */

import { Keypair } from "@stellar/stellar-base";
import { describe, expect, it, vi } from "vitest";

import type { HorizonAccount, StellarHorizonClient } from "./horizonClient.ts";
import { ensureTrustline, hasTrustline } from "./trustlineService.ts";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_CODE = "USDC";

function accountWithBalances(
  balances: HorizonAccount["balances"],
  accountId: string = Keypair.random().publicKey(),
): HorizonAccount {
  return {
    account_id: accountId,
    sequence: "100",
    subentry_count: balances.filter((b) => b.asset_type !== "native").length,
    balances,
  };
}

function mockHorizon(overrides: Partial<StellarHorizonClient> = {}) {
  const base: StellarHorizonClient = {
    horizonUrl: "https://horizon.example",
    networkPassphrase: "Test SDF Network ; September 2015",
    loadAccount: vi.fn(),
    submitTransaction: vi.fn(async () => ({ hash: "deadbeef" })),
  };
  return { ...base, ...overrides };
}

describe("hasTrustline", () => {
  it("returns true when a matching trustline balance row exists", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () =>
        accountWithBalances([
          { asset_type: "native", balance: "10" },
          {
            asset_type: "credit_alphanum4",
            asset_code: USDC_CODE,
            asset_issuer: USDC_ISSUER,
            balance: "0",
            limit: "922337203685.4775807",
          },
        ]),
      ),
    });
    await expect(
      hasTrustline(horizon, "GADDRESS", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(true);
  });

  it("returns false when no matching trustline exists", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () =>
        accountWithBalances([{ asset_type: "native", balance: "10" }]),
      ),
    });
    await expect(
      hasTrustline(horizon, "GADDRESS", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(false);
  });

  it("does not match a trustline to the same code but a different issuer", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () =>
        accountWithBalances([
          {
            asset_type: "credit_alphanum4",
            asset_code: USDC_CODE,
            asset_issuer:
              "GDIFFERENTISSUERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            balance: "0",
          },
        ]),
      ),
    });
    await expect(
      hasTrustline(horizon, "GADDRESS", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(false);
  });

  it("returns false (not an error) for an unfunded destination", async () => {
    const { HorizonRequestError } = await import("./horizonClient.ts");
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () => {
        throw new HorizonRequestError(404);
      }),
    });
    await expect(
      hasTrustline(horizon, "GADDRESS", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(false);
  });
});

describe("ensureTrustline", () => {
  it("returns alreadyTrusted: true without submitting when a trustline already exists", async () => {
    const signer = Keypair.random();
    const submitTransaction = vi.fn(async () => ({ hash: "unused" }));
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () =>
        accountWithBalances([
          {
            asset_type: "credit_alphanum4",
            asset_code: USDC_CODE,
            asset_issuer: USDC_ISSUER,
            balance: "0",
          },
        ]),
      ),
      submitTransaction,
    });
    const result = await ensureTrustline({
      horizon,
      signer,
      code: USDC_CODE,
      issuer: USDC_ISSUER,
    });
    expect(result.alreadyTrusted).toBe(true);
    expect(submitTransaction).not.toHaveBeenCalled();
  });

  it("builds, signs, and submits a changeTrust operation when absent", async () => {
    const signer = Keypair.random();
    const submitTransaction = vi.fn(async () => ({ hash: "deadbeef" }));
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () =>
        accountWithBalances([], signer.publicKey()),
      ),
      submitTransaction,
    });
    const result = await ensureTrustline({
      horizon,
      signer,
      code: USDC_CODE,
      issuer: USDC_ISSUER,
    });
    expect(result.alreadyTrusted).toBe(false);
    expect(result.hash).toBe("deadbeef");
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });
});

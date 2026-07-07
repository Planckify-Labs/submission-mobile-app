/**
 * Spec reference: `docs/stellar-chain-support-spec.md` §9 (test table
 * row 8 — `buildAndSendStellarAssetTransfer` throws
 * `StellarNoTrustlineError` before submitting when the destination
 * lacks a trustline, never letting it round-trip to `op_no_trust`).
 */

import { Keypair } from "@stellar/stellar-base";
import { describe, expect, it, vi } from "vitest";

import {
  buildAndSendStellarAssetTransfer,
  getStellarAssetBalance,
} from "./assetTransferService.ts";
import {
  StellarDestinationUnfundedError,
  StellarNoTrustlineError,
} from "./errorCodes.ts";
import type { HorizonAccount, StellarHorizonClient } from "./horizonClient.ts";
import { HorizonRequestError } from "./horizonClient.ts";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_CODE = "USDC";

function accountWithTrustline(
  accountId: string,
  balance = "0.0000000",
): HorizonAccount {
  return {
    account_id: accountId,
    sequence: "100",
    subentry_count: 1,
    balances: [
      { asset_type: "native", balance: "100.0000000" },
      {
        asset_type: "credit_alphanum4",
        asset_code: USDC_CODE,
        asset_issuer: USDC_ISSUER,
        balance,
      },
    ],
  };
}

function accountWithoutTrustline(accountId: string): HorizonAccount {
  return {
    account_id: accountId,
    sequence: "100",
    subentry_count: 0,
    balances: [{ asset_type: "native", balance: "100.0000000" }],
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

describe("getStellarAssetBalance", () => {
  it("returns the parsed balance for a matching trustline", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () =>
        accountWithTrustline("GADDR", "12.3400000"),
      ),
    });
    await expect(
      getStellarAssetBalance(horizon, "GADDR", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(123_400_000n);
  });

  it("returns 0n when the account exists but has no trustline", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () => accountWithoutTrustline("GADDR")),
    });
    await expect(
      getStellarAssetBalance(horizon, "GADDR", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(0n);
  });

  it("returns 0n when the account doesn't exist", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () => {
        throw new HorizonRequestError(404);
      }),
    });
    await expect(
      getStellarAssetBalance(horizon, "GADDR", USDC_CODE, USDC_ISSUER),
    ).resolves.toBe(0n);
  });
});

describe("buildAndSendStellarAssetTransfer", () => {
  it("throws StellarDestinationUnfundedError before submitting when the destination doesn't exist", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const submitTransaction = vi.fn();
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) => {
        if (address === destination) throw new HorizonRequestError(404);
        return accountWithTrustline(signer.publicKey());
      }),
      submitTransaction,
    });
    await expect(
      buildAndSendStellarAssetTransfer({
        horizon,
        signer,
        to: destination,
        code: USDC_CODE,
        issuer: USDC_ISSUER,
        amount: 10_000_000n,
      }),
    ).rejects.toThrow(StellarDestinationUnfundedError);
    expect(submitTransaction).not.toHaveBeenCalled();
  });

  it("throws StellarNoTrustlineError before submitting when the destination lacks a trustline (never round-trips to op_no_trust)", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const submitTransaction = vi.fn();
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) => {
        if (address === destination)
          return accountWithoutTrustline(destination);
        return accountWithTrustline(signer.publicKey());
      }),
      submitTransaction,
    });
    await expect(
      buildAndSendStellarAssetTransfer({
        horizon,
        signer,
        to: destination,
        code: USDC_CODE,
        issuer: USDC_ISSUER,
        amount: 10_000_000n,
      }),
    ).rejects.toThrow(StellarNoTrustlineError);
    expect(submitTransaction).not.toHaveBeenCalled();
  });

  it("builds and submits a payment when the destination already trusts the asset", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const submitTransaction = vi.fn(async (tx) => {
      expect(tx.operations[0].type).toBe("payment");
      return { hash: "cafebabe" };
    });
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) =>
        address === destination
          ? accountWithTrustline(destination)
          : accountWithTrustline(signer.publicKey()),
      ),
      submitTransaction,
    });
    const hash = await buildAndSendStellarAssetTransfer({
      horizon,
      signer,
      to: destination,
      code: USDC_CODE,
      issuer: USDC_ISSUER,
      amount: 5_000_000n,
    });
    expect(hash).toBe("cafebabe");
  });
});

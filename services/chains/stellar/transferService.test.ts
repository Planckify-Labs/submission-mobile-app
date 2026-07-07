/**
 * Spec reference: `docs/stellar-chain-support-spec.md` §9 (test table
 * rows 5, 11 — createAccount vs payment dispatch).
 */

import { Keypair } from "@stellar/stellar-base";
import { describe, expect, it, vi } from "vitest";
import {
  StellarAccountNotFoundError,
  StellarInsufficientCreateAmountError,
  StellarSequenceNumberRaceError,
} from "./errorCodes.ts";
import type { HorizonAccount, StellarHorizonClient } from "./horizonClient.ts";
import { HorizonRequestError } from "./horizonClient.ts";
import {
  buildAndSendStellarNativeTransfer,
  getStellarNativeBalance,
} from "./transferService.ts";

function nativeAccount(
  accountId: string,
  balance: string,
  sequence = "100",
): HorizonAccount {
  return {
    account_id: accountId,
    sequence,
    subentry_count: 0,
    balances: [{ asset_type: "native", balance }],
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

describe("getStellarNativeBalance", () => {
  it("returns the parsed stroops balance", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () => nativeAccount("GADDR", "10.5000000")),
    });
    await expect(getStellarNativeBalance(horizon, "GADDR")).resolves.toBe(
      105_000_000n,
    );
  });

  it("returns 0n for an unfunded address", async () => {
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () => {
        throw new HorizonRequestError(404);
      }),
    });
    await expect(getStellarNativeBalance(horizon, "GADDR")).resolves.toBe(0n);
  });
});

describe("buildAndSendStellarNativeTransfer", () => {
  it("throws StellarAccountNotFoundError when the SOURCE wallet has never been funded", async () => {
    const signer = Keypair.random();
    const horizon = mockHorizon({
      loadAccount: vi.fn(async () => {
        throw new HorizonRequestError(404);
      }),
    });
    await expect(
      buildAndSendStellarNativeTransfer({
        horizon,
        signer,
        to: Keypair.random().publicKey(),
        stroops: 10_000_000n,
      }),
    ).rejects.toThrow(StellarAccountNotFoundError);
  });

  it("dispatches Operation.createAccount for an unfunded destination", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const submitTransaction = vi.fn(async (tx) => {
      // Assert the built XDR contains a createAccount operation (op type 0).
      expect(tx.operations[0].type).toBe("createAccount");
      return { hash: "deadbeef" };
    });
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) => {
        if (address === destination) {
          throw new HorizonRequestError(404);
        }
        return nativeAccount(signer.publicKey(), "1000.0000000");
      }),
      submitTransaction,
    });
    const hash = await buildAndSendStellarNativeTransfer({
      horizon,
      signer,
      to: destination,
      stroops: 10_000_000n, // exactly 1 XLM — the minimum new-account reserve
    });
    expect(hash).toBe("deadbeef");
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws StellarInsufficientCreateAmountError when funding a new account below the minimum reserve", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) => {
        if (address === destination) {
          throw new HorizonRequestError(404);
        }
        return nativeAccount(signer.publicKey(), "1000.0000000");
      }),
    });
    await expect(
      buildAndSendStellarNativeTransfer({
        horizon,
        signer,
        to: destination,
        stroops: 5_000_000n, // 0.5 XLM — below the 1 XLM floor
      }),
    ).rejects.toThrow(StellarInsufficientCreateAmountError);
  });

  it("dispatches Operation.payment for a funded destination", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const submitTransaction = vi.fn(async (tx) => {
      expect(tx.operations[0].type).toBe("payment");
      return { hash: "cafebabe" };
    });
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) =>
        address === destination
          ? nativeAccount(destination, "5.0000000")
          : nativeAccount(signer.publicKey(), "1000.0000000"),
      ),
      submitTransaction,
    });
    const hash = await buildAndSendStellarNativeTransfer({
      horizon,
      signer,
      to: destination,
      stroops: 1_000_000n,
    });
    expect(hash).toBe("cafebabe");
  });

  it("maps a tx_bad_seq submission failure to StellarSequenceNumberRaceError", async () => {
    const signer = Keypair.random();
    const destination = Keypair.random().publicKey();
    const horizon = mockHorizon({
      loadAccount: vi.fn(async (address: string) =>
        address === destination
          ? nativeAccount(destination, "5.0000000")
          : nativeAccount(signer.publicKey(), "1000.0000000"),
      ),
      submitTransaction: vi.fn(async () => {
        throw new HorizonRequestError(400, { transaction: "tx_bad_seq" });
      }),
    });
    await expect(
      buildAndSendStellarNativeTransfer({
        horizon,
        signer,
        to: destination,
        stroops: 1_000_000n,
      }),
    ).rejects.toThrow(StellarSequenceNumberRaceError);
  });
});

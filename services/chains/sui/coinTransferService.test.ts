/**
 * Unit tests for `services/chains/sui/coinTransferService.ts`.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §4.1.
 *
 * Coverage:
 *   - Detector returns null     → `SuiUnsupportedTokenKindError`.
 *   - Empty `getCoins` page     → `SuiInsufficientCoinError`.
 *   - signAndExecuteTransaction
 *     throws "EAddressDeniedForCoin"
 *     for a regulated coin     → `SuiRegulatedCoinDeniedError`.
 *   - Closed-loop dispatch     → `SuiClosedLoopPolicyUnresolvedError`
 *                                 (v1 punt, see TODO(task-07-followup)).
 */

import { describe, expect, it, vi } from "vitest";

import { buildAndSendSuiCoinTransfer } from "./coinTransferService.ts";
import { clearSuiTokenKindCache } from "./tokenKind.ts";

const RECIPIENT =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const COIN_TYPE = "0xpkg::token::TOKEN";

interface MockSigner {
  toSuiAddress: () => string;
}

function makeSigner(addr = "0xowner"): MockSigner {
  return { toSuiAddress: () => addr };
}

describe("buildAndSendSuiCoinTransfer — unsupported", () => {
  it("throws SuiUnsupportedTokenKindError when getCoinMetadata returns null and no policy resolves", async () => {
    clearSuiTokenKindCache();
    const client = {
      getCoinMetadata: vi.fn().mockResolvedValue(null),
      queryEvents: vi.fn().mockResolvedValue({ data: [] }),
    };

    await expect(
      buildAndSendSuiCoinTransfer({
        client: client as never,
        signer: makeSigner() as never,
        to: RECIPIENT,
        coinType: COIN_TYPE,
        amount: 1n,
      }),
    ).rejects.toMatchObject({
      name: "SuiUnsupportedTokenKindError",
      coinType: COIN_TYPE,
    });
  });
});

describe("buildAndSendSuiCoinTransfer — Coin<T> path", () => {
  it("throws SuiInsufficientCoinError when getCoins is empty", async () => {
    clearSuiTokenKindCache();
    const client = {
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 6 }),
      getDynamicFieldObject: vi.fn().mockResolvedValue({ data: null }),
      getCoins: vi.fn().mockResolvedValue({ data: [] }),
      signAndExecuteTransaction: vi.fn(),
    };

    await expect(
      buildAndSendSuiCoinTransfer({
        client: client as never,
        signer: makeSigner() as never,
        to: RECIPIENT,
        coinType: COIN_TYPE,
        amount: 1n,
      }),
    ).rejects.toMatchObject({
      name: "SuiInsufficientCoinError",
      coinType: COIN_TYPE,
    });
    expect(client.signAndExecuteTransaction).not.toHaveBeenCalled();
  });

  it("returns the digest on the happy path", async () => {
    clearSuiTokenKindCache();
    const signAndExec = vi.fn().mockResolvedValue({ digest: "0xok" });
    const client = {
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 6 }),
      getDynamicFieldObject: vi.fn().mockResolvedValue({ data: null }),
      getCoins: vi
        .fn()
        .mockResolvedValue({ data: [{ coinObjectId: "0xcoin1" }] }),
      signAndExecuteTransaction: signAndExec,
    };

    const digest = await buildAndSendSuiCoinTransfer({
      client: client as never,
      signer: makeSigner() as never,
      to: RECIPIENT,
      coinType: COIN_TYPE,
      amount: 100n,
    });

    expect(digest).toBe("0xok");
    expect(signAndExec).toHaveBeenCalledTimes(1);
  });

  it("rethrows non-deny-list errors as-is on a non-regulated coin", async () => {
    clearSuiTokenKindCache();
    const client = {
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 6 }),
      getDynamicFieldObject: vi.fn().mockResolvedValue({ data: null }),
      getCoins: vi
        .fn()
        .mockResolvedValue({ data: [{ coinObjectId: "0xcoin1" }] }),
      signAndExecuteTransaction: vi
        .fn()
        .mockRejectedValue(new Error("rpc 503")),
    };

    await expect(
      buildAndSendSuiCoinTransfer({
        client: client as never,
        signer: makeSigner() as never,
        to: RECIPIENT,
        coinType: COIN_TYPE,
        amount: 1n,
      }),
    ).rejects.toThrow(/rpc 503/);
  });
});

describe("buildAndSendSuiCoinTransfer — regulated coin", () => {
  it("rethrows EAddressDeniedForCoin as SuiRegulatedCoinDeniedError", async () => {
    clearSuiTokenKindCache();
    const denyId = "0xdenylist";
    const cause = new Error(
      "MoveAbort(... coin::deny_list_v2 ... EAddressDeniedForCoin) at instruction 3",
    );
    const client = {
      getCoinMetadata: vi.fn().mockResolvedValue({ decimals: 6 }),
      // Regulated detection: deny-list lookup returns an objectId.
      getDynamicFieldObject: vi
        .fn()
        .mockResolvedValue({ data: { objectId: denyId } }),
      getCoins: vi
        .fn()
        .mockResolvedValue({ data: [{ coinObjectId: "0xcoin1" }] }),
      signAndExecuteTransaction: vi.fn().mockRejectedValue(cause),
    };

    await expect(
      buildAndSendSuiCoinTransfer({
        client: client as never,
        signer: makeSigner() as never,
        to: RECIPIENT,
        coinType: COIN_TYPE,
        amount: 1n,
      }),
    ).rejects.toMatchObject({
      name: "SuiRegulatedCoinDeniedError",
      coinType: COIN_TYPE,
      cause,
    });
  });
});

describe("buildAndSendSuiCoinTransfer — closed-loop", () => {
  it("throws SuiClosedLoopPolicyUnresolvedError (v1 punt — see TODO)", async () => {
    clearSuiTokenKindCache();
    const client = {
      // No metadata → not a Coin<T>. Detector falls through to closed-loop.
      getCoinMetadata: vi.fn().mockResolvedValue(null),
      // Policy event surfaces an id + decimals → kind === "closed-loop".
      queryEvents: vi.fn().mockResolvedValue({
        data: [{ parsedJson: { policy_id: "0xpolicy", decimals: 0 } }],
      }),
      signAndExecuteTransaction: vi.fn(),
    };

    await expect(
      buildAndSendSuiCoinTransfer({
        client: client as never,
        signer: makeSigner() as never,
        to: RECIPIENT,
        coinType: COIN_TYPE,
        amount: 1n,
      }),
    ).rejects.toMatchObject({
      name: "SuiClosedLoopPolicyUnresolvedError",
      coinType: COIN_TYPE,
    });
    expect(client.signAndExecuteTransaction).not.toHaveBeenCalled();
  });
});

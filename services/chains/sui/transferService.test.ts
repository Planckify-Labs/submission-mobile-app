/**
 * Unit tests for `services/chains/sui/transferService.ts`.
 *
 * Style mirrors `services/chains/solana/transferService.test.ts`. We
 * mock the JSON-RPC client's `signAndExecuteTransaction` + `getBalance`
 * so we can assert the PTB shape without hitting a network.
 *
 * What we cover:
 *   - `getSuiNativeBalance` coerces `totalBalance` to `bigint`.
 *   - `buildAndSendSuiTransfer` passes a `Transaction` instance to the
 *     client, returns the digest, and threads `args.signer` through.
 */

import { isTransaction, Transaction } from "@mysten/sui/transactions";
import { describe, expect, it, vi } from "vitest";

import {
  buildAndSendSuiTransfer,
  getSuiNativeBalance,
} from "./transferService.ts";

const RECIPIENT =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("getSuiNativeBalance", () => {
  it("coerces totalBalance to bigint", async () => {
    const client = {
      getBalance: vi.fn().mockResolvedValue({ totalBalance: "1234567890" }),
    };
    const got = await getSuiNativeBalance(client as never, RECIPIENT);
    expect(got).toBe(1234567890n);
    expect(client.getBalance).toHaveBeenCalledWith({ owner: RECIPIENT });
  });

  it("handles numeric totalBalance from a JSON transport", async () => {
    const client = {
      getBalance: vi.fn().mockResolvedValue({ totalBalance: 42 }),
    };
    const got = await getSuiNativeBalance(client as never, RECIPIENT);
    expect(got).toBe(42n);
  });
});

describe("buildAndSendSuiTransfer", () => {
  it("submits a Transaction PTB and returns the digest", async () => {
    const captured: { transaction?: unknown; signer?: unknown } = {};
    const signAndExec = vi.fn().mockImplementation(async (input) => {
      captured.transaction = input.transaction;
      captured.signer = input.signer;
      return { digest: "0xdigest" };
    });

    const client = { signAndExecuteTransaction: signAndExec };
    // Stand-in for the keypair — `signAndExecuteTransaction` only reads
    // it, never invokes methods on it (the SDK does that internally).
    // We assert it round-trips by reference.
    const signer = { __mock: "signer" };

    const digest = await buildAndSendSuiTransfer({
      client: client as never,
      signer: signer as never,
      to: RECIPIENT,
      mist: 1_000_000_000n,
    });

    expect(digest).toBe("0xdigest");
    expect(captured.signer).toBe(signer);
    expect(isTransaction(captured.transaction)).toBe(true);
    // Cross-check via instanceof for explicitness — `isTransaction`
    // already enforces it, but we want the failure mode to be obvious
    // if a future refactor swaps the helper.
    expect(captured.transaction).toBeInstanceOf(Transaction);
    expect(signAndExec).toHaveBeenCalledTimes(1);
  });

  it("threads the showEffects:false option through to the client", async () => {
    const signAndExec = vi.fn().mockResolvedValue({ digest: "0xdig2" });
    const client = { signAndExecuteTransaction: signAndExec };

    await buildAndSendSuiTransfer({
      client: client as never,
      signer: {} as never,
      to: RECIPIENT,
      mist: 1n,
    });

    const call = signAndExec.mock.calls[0]?.[0];
    expect(call?.options).toEqual({ showEffects: false });
  });
});

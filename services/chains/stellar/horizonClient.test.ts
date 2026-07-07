/**
 * Regression guard for the `transaction_malformed` bug (spec follow-up):
 * `tx.toXDR()` relies on `@stellar/js-xdr`'s ambient-global-`Buffer`
 * based `.toString("base64")`, which does not work correctly under
 * this app's Hermes runtime. `transactionToBase64Xdr` bypasses it by
 * reading the raw envelope bytes and encoding them via `bytesToBase64`
 * (btoa-based) instead. This test pins that the result is valid,
 * parseable base64 XDR that round-trips through
 * `TransactionBuilder.fromXDR` — the same check Horizon itself does on
 * submission.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";
import { describe, expect, it } from "vitest";

import { transactionToBase64Xdr } from "./horizonClient.ts";

describe("transactionToBase64Xdr", () => {
  it("produces base64 XDR that round-trips through TransactionBuilder.fromXDR", () => {
    const kp = Keypair.random();
    const account = new Account(kp.publicKey(), "1");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: kp.publicKey(),
          asset: Asset.native(),
          amount: "1",
        }),
      )
      .setTimeout(180)
      .build();
    tx.sign(kp);

    const xdr = transactionToBase64Xdr(tx);

    // The bug this guards against: a comma-joined decimal byte list
    // instead of base64 — Horizon rejects that outright as
    // `transaction_malformed`.
    expect(xdr).not.toContain(",");
    expect(xdr).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);

    const rebuilt = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    expect(rebuilt.toXDR()).toBe(tx.toXDR());
  });

  it("produces a non-empty envelope for a changeTrust transaction", () => {
    const kp = Keypair.random();
    const account = new Account(kp.publicKey(), "1");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: new Asset(
            "USDC",
            "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          ),
        }),
      )
      .setTimeout(180)
      .build();
    tx.sign(kp);

    const xdr = transactionToBase64Xdr(tx);
    expect(xdr.length).toBeGreaterThan(0);
    expect(() =>
      TransactionBuilder.fromXDR(xdr, Networks.TESTNET),
    ).not.toThrow();
  });
});

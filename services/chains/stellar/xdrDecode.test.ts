/**
 * `decodeStellarTransaction` — fixtures generated directly from
 * `@stellar/stellar-base`'s own builders (never hand-encoded XDR), same
 * "generate the fixture from the SDK" discipline
 * `stellar-chain-support-spec.md` §9 already uses.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";
import { describe, expect, it } from "vitest";

import { transactionToBase64Xdr } from "./horizonClient.ts";
import { decodeStellarTransaction } from "./xdrDecode.ts";

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function buildXdr(
  ops: ReturnType<typeof Operation.payment>[],
  opts?: { memo?: Memo; source?: Keypair },
): { xdr: string; sourceKp: Keypair } {
  const kp = opts?.source ?? Keypair.random();
  const account = new Account(kp.publicKey(), "100");
  let builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
    memo: opts?.memo,
  });
  for (const op of ops) builder = builder.addOperation(op);
  const tx = builder.setTimeout(180).build();
  tx.sign(kp);
  return { xdr: transactionToBase64Xdr(tx), sourceKp: kp };
}

describe("decodeStellarTransaction", () => {
  it("decodes a native payment", () => {
    const dest = Keypair.random().publicKey();
    const { xdr, sourceKp } = buildXdr([
      Operation.payment({
        destination: dest,
        asset: Asset.native(),
        amount: "12.5",
      }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.sourceAccount).toBe(sourceKp.publicKey());
    expect(decoded.sequence).toBe("101");
    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0]).toMatchObject({
      kind: "payment",
      destination: dest,
      asset: "native",
      amount: "12.5000000",
    });
  });

  it("decodes a non-native payment with CODE:ISSUER asset string", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr([
      Operation.payment({
        destination: dest,
        asset: new Asset("USDC", USDC_ISSUER),
        amount: "3",
      }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0]).toMatchObject({
      kind: "payment",
      asset: `USDC:${USDC_ISSUER}`,
    });
  });

  it("decodes createAccount", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr([
      Operation.createAccount({ destination: dest, startingBalance: "5" }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0]).toMatchObject({
      kind: "createAccount",
      destination: dest,
      startingBalance: "5.0000000",
    });
  });

  it("decodes changeTrust — asset comes from the `line` field, not `asset`", () => {
    const { xdr } = buildXdr([
      Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0].kind).toBe("changeTrust");
    if (decoded.operations[0].kind === "changeTrust") {
      expect(decoded.operations[0].asset).toBe(`USDC:${USDC_ISSUER}`);
      // Default limit is the max i64 sentinel per Stellar's own convention.
      expect(decoded.operations[0].limit).toBe("922337203685.4775807");
    }
  });

  it("decodes accountMerge", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr([Operation.accountMerge({ destination: dest })]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0]).toMatchObject({
      kind: "accountMerge",
      destination: dest,
    });
  });

  it("decodes pathPaymentStrictSend", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr([
      Operation.pathPaymentStrictSend({
        sendAsset: Asset.native(),
        sendAmount: "10",
        destination: dest,
        destAsset: new Asset("USDC", USDC_ISSUER),
        destMin: "9",
        path: [],
      }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0]).toMatchObject({
      kind: "pathPaymentStrictSend",
      destination: dest,
      sendAsset: "native",
      destAsset: `USDC:${USDC_ISSUER}`,
    });
  });

  it("decodes manageSellOffer", () => {
    const { xdr } = buildXdr([
      Operation.manageSellOffer({
        selling: Asset.native(),
        buying: new Asset("USDC", USDC_ISSUER),
        amount: "100",
        price: "0.5",
        offerId: "0",
      }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0]).toMatchObject({
      kind: "manageSellOffer",
      selling: "native",
      buying: `USDC:${USDC_ISSUER}`,
    });
  });

  it("decodes a text memo", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr(
      [
        Operation.payment({
          destination: dest,
          asset: Asset.native(),
          amount: "1",
        }),
      ],
      { memo: Memo.text("hello") },
    );
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.memo).toEqual({ type: "text", value: "hello" });
  });

  it("defaults to a `none` memo when the transaction carries none", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr([
      Operation.payment({
        destination: dest,
        asset: Asset.native(),
        amount: "1",
      }),
    ]);
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.memo).toEqual({ type: "none" });
  });

  it("decodes an unrecognized/future operation type as `other`", () => {
    const dest = Keypair.random().publicKey();
    const { xdr } = buildXdr([
      Operation.bumpSequence({ bumpTo: "999" }) as unknown as ReturnType<
        typeof Operation.payment
      >,
    ]);
    void dest;
    const decoded = decodeStellarTransaction(xdr, Networks.TESTNET);
    expect(decoded.operations[0]).toMatchObject({
      kind: "other",
      type: "bumpSequence",
    });
  });

  it("throws on malformed XDR rather than silently swallowing the error", () => {
    expect(() =>
      decodeStellarTransaction("not-valid-xdr", Networks.TESTNET),
    ).toThrow();
  });
});

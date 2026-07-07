/**
 * Trustline check / establishment — Stellar's "SPL-vs-Token-2022"
 * analogue (spec §1.5, §4.1).
 *
 * An account cannot hold or receive a non-native asset without first
 * submitting a `changeTrust` operation to that specific `(code, issuer)`
 * pair. Unlike Sui's `detectSuiTokenKind` (classifying an EXISTING
 * on-chain object), this is a proactive yes/no check the SENDER's UI
 * must offer to the RECEIVER before a payment can succeed — no amount
 * of sender-side signing can complete a transfer to an account that
 * hasn't opted in.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  type Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";
import type { StellarHorizonClient } from "./horizonClient";
import { isHorizonNotFound } from "./horizonClient";

/**
 * Returns whether `address` already has a trustline to `(code, issuer)`.
 * Returns `false` (not an error) when the account doesn't exist yet —
 * an unfunded account trivially has no trustlines.
 */
export async function hasTrustline(
  horizon: StellarHorizonClient,
  address: string,
  code: string,
  issuer: string,
): Promise<boolean> {
  try {
    const account = await horizon.loadAccount(address);
    return account.balances.some(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_code === code &&
        b.asset_issuer === issuer,
    );
  } catch (e) {
    if (isHorizonNotFound(e)) return false;
    throw e;
  }
}

export interface EnsureTrustlineArgs {
  horizon: StellarHorizonClient;
  signer: Keypair;
  code: string;
  issuer: string;
  /** Trustline limit. Defaults to the SDK's max (`Operation.changeTrust`'s own default) when omitted. */
  limit?: string;
}

export interface EnsureTrustlineResult {
  alreadyTrusted: boolean;
  hash?: string;
}

/**
 * Establishes a trustline FOR THE CALLER'S OWN WALLET (self-service —
 * e.g. before receiving USDC for the first time). Cannot establish a
 * trustline on behalf of someone else; that requires a different
 * account's signature.
 */
export async function ensureTrustline(
  args: EnsureTrustlineArgs,
): Promise<EnsureTrustlineResult> {
  const address = args.signer.publicKey();
  const already = await hasTrustline(
    args.horizon,
    address,
    args.code,
    args.issuer,
  );
  if (already) return { alreadyTrusted: true };

  const account = await args.horizon.loadAccount(address);
  const tx = new TransactionBuilder(
    new Account(account.account_id, account.sequence),
    { fee: BASE_FEE, networkPassphrase: args.horizon.networkPassphrase },
  )
    .addOperation(
      Operation.changeTrust({
        asset: new Asset(args.code, args.issuer),
        limit: args.limit,
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(args.signer);
  const { hash } = await args.horizon.submitTransaction(tx);
  return { alreadyTrusted: false, hash };
}

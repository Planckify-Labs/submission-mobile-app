/**
 * Non-native (trustline-gated) asset transfer.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §1.5, §3.5, §4.1.
 *
 * Non-native assets cannot be the first transfer to a new address — the
 * destination must exist (via an XLM `createAccount`) and hold a
 * trustline (via its own signed `changeTrust`) before anyone can pay it
 * in that asset. This module checks both preconditions and surfaces
 * typed errors BEFORE submitting, rather than letting the payment
 * round-trip to Horizon just to get `op_no_trust` / a missing-account
 * failure back.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  type Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";
import { detectAccountFunded } from "./accountState";
import {
  formatStroopsAsDecimalString,
  parseDecimalStringAsStroops,
} from "./amount";
import {
  StellarAccountNotFoundError,
  StellarDestinationUnfundedError,
  StellarNoTrustlineError,
  StellarSequenceNumberRaceError,
} from "./errorCodes";
import {
  HorizonRequestError,
  isHorizonNotFound,
  type StellarHorizonClient,
} from "./horizonClient";
import { hasTrustline } from "./trustlineService";

/**
 * Returns the balance (in stroops-equivalent smallest units) of a
 * non-native asset `(code, issuer)` for `address`. Returns `0n` both
 * when the account doesn't exist and when it exists but has no
 * trustline to the asset — both cases correctly read as "holds none of
 * this asset".
 */
export async function getStellarAssetBalance(
  horizon: StellarHorizonClient,
  address: string,
  code: string,
  issuer: string,
): Promise<bigint> {
  try {
    const account = await horizon.loadAccount(address);
    const line = account.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_code === code &&
        b.asset_issuer === issuer,
    );
    return line ? parseDecimalStringAsStroops(line.balance) : 0n;
  } catch (e) {
    if (isHorizonNotFound(e)) return 0n;
    throw e;
  }
}

export interface BuildAndSendStellarAssetTransferArgs {
  horizon: StellarHorizonClient;
  signer: Keypair;
  to: string;
  code: string;
  issuer: string;
  /** Amount in the asset's smallest unit (7 decimals, spec §3.8). */
  amount: bigint;
}

/**
 * Build, sign, and submit a non-native asset `payment` operation.
 * Pre-flight checks (in order):
 *   1. Destination exists on-ledger — else `StellarDestinationUnfundedError`.
 *   2. Destination already trusts `(code, issuer)` — else `StellarNoTrustlineError`.
 * Returns the Horizon transaction hash.
 */
export async function buildAndSendStellarAssetTransfer(
  args: BuildAndSendStellarAssetTransferArgs,
): Promise<string> {
  const sourceAddress = args.signer.publicKey();

  let sourceAccount: Awaited<ReturnType<StellarHorizonClient["loadAccount"]>>;
  try {
    sourceAccount = await args.horizon.loadAccount(sourceAddress);
  } catch (e) {
    if (isHorizonNotFound(e)) {
      throw new StellarAccountNotFoundError(sourceAddress);
    }
    throw e;
  }

  const destinationFunded = await detectAccountFunded(args.horizon, args.to);
  if (!destinationFunded) {
    throw new StellarDestinationUnfundedError(args.to);
  }

  const destinationTrusts = await hasTrustline(
    args.horizon,
    args.to,
    args.code,
    args.issuer,
  );
  if (!destinationTrusts) {
    throw new StellarNoTrustlineError(args.to, args.code, args.issuer);
  }

  const tx = new TransactionBuilder(
    new Account(sourceAccount.account_id, sourceAccount.sequence),
    { fee: BASE_FEE, networkPassphrase: args.horizon.networkPassphrase },
  )
    .addOperation(
      Operation.payment({
        destination: args.to,
        asset: new Asset(args.code, args.issuer),
        amount: formatStroopsAsDecimalString(args.amount),
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(args.signer);

  try {
    const { hash } = await args.horizon.submitTransaction(tx);
    return hash;
  } catch (e) {
    if (
      e instanceof HorizonRequestError &&
      e.resultCodes?.transaction === "tx_bad_seq"
    ) {
      throw new StellarSequenceNumberRaceError();
    }
    throw e;
  }
}

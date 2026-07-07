/**
 * Native XLM transfer — dispatches `createAccount` vs `payment` based on
 * whether the destination already exists on-ledger (spec §3.5).
 *
 * Unlike Sui/Solana ("just try the send, map the on-chain revert to a
 * typed error"), an unfunded Stellar destination isn't a revert — it's
 * a precondition the client must detect and route around BEFORE
 * building the transaction.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  type Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";
import {
  detectAccountFunded,
  NEW_ACCOUNT_MIN_BALANCE_STROOPS,
} from "./accountState";
import {
  formatStroopsAsDecimalString,
  parseDecimalStringAsStroops,
} from "./amount";
import {
  StellarAccountNotFoundError,
  StellarInsufficientCreateAmountError,
  StellarSequenceNumberRaceError,
} from "./errorCodes";
import {
  HorizonRequestError,
  isHorizonNotFound,
  type StellarHorizonClient,
} from "./horizonClient";

/**
 * Returns the native XLM balance (in stroops) for `address`. Returns
 * `0n` for an unfunded address rather than throwing — mirrors the
 * `getSuiNativeBalance` / Solana equivalent's "no balance" convention.
 */
export async function getStellarNativeBalance(
  horizon: StellarHorizonClient,
  address: string,
): Promise<bigint> {
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? parseDecimalStringAsStroops(native.balance) : 0n;
  } catch (e) {
    if (isHorizonNotFound(e)) return 0n;
    throw e;
  }
}

export interface BuildAndSendStellarNativeTransferArgs {
  horizon: StellarHorizonClient;
  signer: Keypair;
  to: string;
  /** Amount in stroops. Never a human string — bigint end-to-end. */
  stroops: bigint;
}

/**
 * Build, sign, and submit a native-XLM transfer. Picks
 * `Operation.createAccount` when the destination has no ledger entry
 * yet, `Operation.payment` otherwise (spec §3.5). Returns the Horizon
 * transaction hash.
 */
export async function buildAndSendStellarNativeTransfer(
  args: BuildAndSendStellarNativeTransferArgs,
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
  const amount = formatStroopsAsDecimalString(args.stroops);

  const txBuilder = new TransactionBuilder(
    new Account(sourceAccount.account_id, sourceAccount.sequence),
    { fee: BASE_FEE, networkPassphrase: args.horizon.networkPassphrase },
  );

  if (!destinationFunded) {
    if (args.stroops < NEW_ACCOUNT_MIN_BALANCE_STROOPS) {
      throw new StellarInsufficientCreateAmountError(
        args.stroops,
        NEW_ACCOUNT_MIN_BALANCE_STROOPS,
      );
    }
    txBuilder.addOperation(
      Operation.createAccount({
        destination: args.to,
        startingBalance: amount,
      }),
    );
  } else {
    txBuilder.addOperation(
      Operation.payment({
        destination: args.to,
        asset: Asset.native(),
        amount,
      }),
    );
  }

  const tx = txBuilder.setTimeout(180).build();
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

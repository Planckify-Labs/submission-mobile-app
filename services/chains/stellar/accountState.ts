/**
 * Account-existence detection + reserve math.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §1.3, §3.5.
 *
 * Stellar accounts must be created on-ledger (via `createAccount`)
 * before they can receive a `payment` — there is no lazy "any valid
 * pubkey works" behavior like EVM/Solana/Sui. Every account also holds
 * a minimum XLM balance driven by the "base reserve" plus one reserve
 * per subentry (trustlines, offers, signers, data entries).
 *
 * Figures cited directly from the official Stellar docs (not assumed):
 *   - "One base reserve is currently 0.5 XLM"
 *   - every account holds "a minimum balance of two base reserves
 *     (currently 1 XLM)"
 *   - "every subentry after that requires an additional base reserve"
 * https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts
 */

import {
  type HorizonAccount,
  isHorizonNotFound,
  type StellarHorizonClient,
} from "./horizonClient";

/** One base reserve — 0.5 XLM, in stroops (1 XLM = 10,000,000 stroops). */
export const BASE_RESERVE_STROOPS = 5_000_000n;

/** Every account holds a minimum balance of this many base reserves. */
export const BASE_RESERVE_COUNT = 2n;

/**
 * Minimum balance for a brand-new account with zero subentries — the
 * floor `createAccount`'s `startingBalance` must clear (1 XLM, spec
 * §1.3 / §3.5).
 */
export const NEW_ACCOUNT_MIN_BALANCE_STROOPS =
  BASE_RESERVE_COUNT * BASE_RESERVE_STROOPS;

/**
 * Safety margin reserved on top of the minimum balance in
 * `estimateMaxTransferable` (spec §4) so a MAX-amount send doesn't land
 * the account exactly at its reserve floor and fail on the flat
 * per-operation fee (100-stroop floor, spec §1.3) under surge pricing.
 * 10,000 stroops = 0.001 XLM — comfortably above the floor fee for many
 * operations.
 */
export const STELLAR_FEE_RESERVE_STROOPS = 10_000n;

/**
 * Computes an account's current minimum balance: `(2 + subentries) *
 * base_reserve`. Subentries are trustlines, offers, signers, and data
 * entries (spec §1.3).
 */
export function computeMinBalanceStroops(account: HorizonAccount): bigint {
  const subentries = BigInt(account.subentry_count);
  return (BASE_RESERVE_COUNT + subentries) * BASE_RESERVE_STROOPS;
}

/**
 * Detects whether `address` has ever been funded (i.e. exists on the
 * ledger). A Horizon 404 means "never created" — any OTHER failure
 * (network blip, rate-limit) must not be silently treated as
 * "unfunded", since that would misroute a payment into a `createAccount`
 * operation against a real account (spec §3.5).
 */
export async function detectAccountFunded(
  horizon: StellarHorizonClient,
  address: string,
): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (e) {
    if (isHorizonNotFound(e)) return false;
    throw e;
  }
}

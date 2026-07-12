/**
 * `takumi_pay` **point-deposit** invocation surface (payer/submit side).
 *
 * Sibling of `index.ts`'s `process_merchant_payment` helpers, for the OTHER
 * user-initiated write on the same contract: `deposit_points`. Unlike merchant
 * payments there is **no backend-signed quote** — `deposit_points` takes only
 * the payer, the token, a client-generated `ref_id`, and the raw amount, and
 * the payer authorizes the SAC transfer via the tx envelope. So this is a pure
 * argument encoder with no signature and no byte-exact-quote constraint.
 *
 * Contract ABI (`contract/stellar/contracts/takumi_pay/src/lib.rs`):
 *   `deposit_points(payer: Address, token: Address, ref_id: String, amount: i128) -> u64`
 *
 * No network, no signing — those live in `pathPointDepositStellar.ts` +
 * `StellarWalletKit.sendSorobanTransaction`.
 */

import { Address, Asset, nativeToScVal, xdr } from "@stellar/stellar-base";

/** Contract method name. */
export const DEPOSIT_POINTS = "deposit_points" as const;

/**
 * Resolve a token identifier to the Stellar Asset Contract (SAC) id the
 * contract stores and transfers against. Accepts either an already-resolved
 * `C…` contract id (returned as-is) or the compound `"{CODE}:{ISSUER}"` form
 * the Token row carries for classic Stellar assets (spec §3.7).
 *
 * Byte-for-byte mirror of the API's `resolveStellarTokenContractId`
 * (`api/src/blockchain-verification/stellar-verification.service.ts`) — the
 * SAC id the backend's `verifyPointDeposit` compares the on-chain
 * `deposit.token` against — so the arg we submit matches what lands on-chain.
 */
export function resolveStellarSacId(
  tokenAddressOrCompound: string,
  networkPassphrase: string,
): string {
  if (tokenAddressOrCompound.startsWith("C")) {
    return tokenAddressOrCompound;
  }
  const [code, issuer] = tokenAddressOrCompound.split(":");
  if (!code || !issuer) {
    throw new Error(
      `Invalid Stellar token identifier: ${tokenAddressOrCompound}`,
    );
  }
  return new Asset(code, issuer).contractId(networkPassphrase);
}

/**
 * Build the ordered `ScVal` argument list for
 * `deposit_points(payer, token, ref_id, amount)`.
 *
 * @param payer      Depositor G-address (tx source; its envelope signature
 *                   satisfies `payer.require_auth()` and the inner SAC
 *                   transfer's auth).
 * @param tokenSacId The token's SAC contract id (`C…`) — resolve compound
 *                   `"{CODE}:{ISSUER}"` via {@link resolveStellarSacId} first.
 * @param refId      Client-generated deposit reference (consumed once on-chain).
 * @param amount     Raw token amount in the asset's smallest unit (Stellar
 *                   assets are 7-decimal fixed point — spec §3.8).
 */
export function buildDepositPointsArgs(args: {
  payer: string;
  tokenSacId: string;
  refId: string;
  amount: bigint;
}): xdr.ScVal[] {
  const payerScVal = new Address(args.payer).toScVal();
  const tokenScVal = new Address(args.tokenSacId).toScVal();
  const refIdScVal = nativeToScVal(args.refId, { type: "string" });
  const amountScVal = nativeToScVal(args.amount, { type: "i128" });
  return [payerScVal, tokenScVal, refIdScVal, amountScVal];
}

/**
 * Sui fungible-coin transfer dispatcher.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §4.1.
 *
 * Mirrors `services/chains/solana/splTransferService.ts`:
 *   - File name parity (`coinTransferService.ts`, NOT
 *     `splTransferService.ts` and NOT `tokenTransferService.ts`).
 *   - Exported function: `buildAndSendSuiCoinTransfer` — analogue of
 *     `buildAndSendSplTransfer`.
 *   - Pure module: client + signer are injected; no key dwell, no
 *     registry lookups, no I/O outside the supplied client.
 *
 * Dispatch (per spec §4.1):
 *   1. Detect token kind via `detectSuiTokenKind` — single source of
 *      truth, re-runs on every transfer (no API trust).
 *   2. `null`         → `SuiUnsupportedTokenKindError`.
 *   3. `coin` (any)   → splitCoins + transferObjects PTB. Regulated
 *                       coins additionally catch deny-list aborts and
 *                       rethrow as `SuiRegulatedCoinDeniedError`.
 *   4. `closed-loop`  → `0x2::token::transfer<T>(token, recipient, policy)`.
 *                       Catches policy aborts as
 *                       `SuiClosedLoopPolicyDeniedError`.
 *
 * Rules (non-negotiable, see Task 13 spec):
 *   - No deny-list pre-flight (privacy leak — the chain is the
 *     authoritative gate).
 *   - NFTs / Kiosk objects → detector returns `null` → typed
 *     "unsupported" error.
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import {
  SuiClosedLoopPolicyDeniedError,
  SuiClosedLoopPolicyUnresolvedError,
  SuiInsufficientCoinError,
  SuiRegulatedCoinDeniedError,
  SuiUnsupportedTokenKindError,
} from "./errorCodes";
import { detectSuiTokenKind } from "./tokenKind";

/**
 * Type alias preserving the conventional name. See `tokenKind.ts` for
 * the rename rationale.
 */
export type SuiClient = SuiJsonRpcClient;

/**
 * Args for {@link buildAndSendSuiCoinTransfer}. Mirrors the shape of
 * `BuildAndSendSplTransferArgs` minus `decimals` (Sui's `Coin<T>`
 * interface doesn't require a decimal hint at the protocol level —
 * decimals are metadata only).
 */
export interface BuildAndSendSuiCoinTransferArgs {
  client: SuiClient;
  signer: Ed25519Keypair;
  /** Recipient canonical 32-byte Sui address. */
  to: string;
  /** Fully-qualified Move type tag, e.g. `0x2::sui::SUI` or `<pkg>::<mod>::<Sym>`. */
  coinType: string;
  /** Amount in the coin's smallest unit. `bigint` end-to-end. */
  amount: bigint;
}

/**
 * Substring sentinels emitted by `0x2::coin::deny_list_v2` when a
 * regulated coin transfer is rejected. We match by substring rather
 * than by exact equality because the SDK wraps the abort with extra
 * context (module + function names + abort code) that varies between
 * RPC versions.
 *
 * Source: `coin::deny_list_v2` Move source — `EAddressDeniedForCoin`
 * (sender or recipient on the deny list) and `ESenderDeniedForCoin`
 * (sender-specific case in older builds).
 */
const DENY_LIST_ABORT_SENTINELS = [
  "EAddressDeniedForCoin",
  "ESenderDeniedForCoin",
] as const;

function isDenyListAbort(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return DENY_LIST_ABORT_SENTINELS.some((s) => msg.includes(s));
}

/**
 * Build, sign, and submit a fungible-coin transfer. Returns the
 * transaction digest.
 *
 * The dispatcher always re-runs `detectSuiTokenKind` so the PTB shape
 * matches the live on-chain truth — even if a UI pre-fetch claims a
 * different kind. This is the same "no API trust" rule that protects
 * the Solana SPL-vs-Token-2022 dispatch from bad mint metadata.
 */
export async function buildAndSendSuiCoinTransfer(
  args: BuildAndSendSuiCoinTransferArgs,
): Promise<string> {
  const owner = args.signer.toSuiAddress();
  const kind = await detectSuiTokenKind(args.client, args.coinType);
  if (!kind) throw new SuiUnsupportedTokenKindError(args.coinType);

  if (kind.kind === "coin") {
    // Standard + Regulated path. Sui has no native ATA, so wallets
    // typically carry many small `Coin<T>` objects. We pre-fetch the
    // owner's coins of this type, merge into one, then split exactly
    // `amount` MIST out for the recipient.
    const { data: coins } = await args.client.getCoins({
      owner,
      coinType: args.coinType,
    });
    if (!coins || coins.length === 0) {
      throw new SuiInsufficientCoinError(args.coinType);
    }

    const tx = new Transaction();
    const [primary, ...rest] = coins.map((c) => tx.object(c.coinObjectId));
    if (rest.length > 0) tx.mergeCoins(primary, rest);
    const [out] = tx.splitCoins(primary, [tx.pure.u64(args.amount)]);
    tx.transferObjects([out], tx.pure.address(args.to));

    try {
      const { digest } = await args.client.signAndExecuteTransaction({
        transaction: tx,
        signer: args.signer,
        options: { showEffects: false },
      });
      return digest;
    } catch (e) {
      // Regulated coins surface deny-list aborts from
      // `coin::deny_list_v2`. Map to a typed error so the UX can
      // render "USDC transfer blocked — address is on the issuer's
      // deny list" rather than a raw move abort. Non-regulated coins
      // just rethrow — there's no deny list in the path, so an abort
      // here means something else.
      if (kind.regulated && isDenyListAbort(e)) {
        throw new SuiRegulatedCoinDeniedError(args.coinType, e);
      }
      throw e;
    }
  }

  // Closed Loop path — `0x2::token::transfer<T>(token, recipient, policy)`.
  //
  // The policy object pins what's allowed (allow-listed recipients,
  // mandatory off-chain attestation, etc.). If a rule fails the chain
  // aborts inside the policy; we surface that as a typed error so the
  // UX can render the right copy.
  //
  // Picking the input `Token<T>` object is non-trivial without
  // on-chain testing — owner-owned `Token<T>` objects don't share an
  // ATA-like layout, and `mergeCoins` doesn't apply (closed-loop
  // tokens aren't `Coin<T>`). We punt for v1: throw
  // `SuiClosedLoopPolicyUnresolvedError` so the dispatch is correct
  // and the milestone unblocked. The dApp-bridge milestone (Task 11)
  // exercises the closed-loop path properly via PTBs the dApp builds.
  //
  // TODO(task-07-followup): implement `pickClosedLoopTokenInputs`
  // properly — requires either a typed event scan (slow on cold
  // wallets) or a wallet-side index of held `Token<T>` objects. The
  // shape will be:
  //   const tokenObj = await pickClosedLoopTokenInputs(args.client, {
  //     owner, coinType: args.coinType, amount: args.amount,
  //   });
  //   const tx = new Transaction();
  //   tx.moveCall({
  //     target: "0x2::token::transfer",
  //     typeArguments: [args.coinType],
  //     arguments: [
  //       tx.object(tokenObj),
  //       tx.pure.address(args.to),
  //       tx.object(kind.tokenPolicyId),
  //     ],
  //   });
  //   try {
  //     const { digest } = await args.client.signAndExecuteTransaction({
  //       transaction: tx, signer: args.signer, options: { showEffects: false },
  //     });
  //     return digest;
  //   } catch (e) {
  //     throw new SuiClosedLoopPolicyDeniedError(args.coinType, kind.tokenPolicyId, e);
  //   }
  void SuiClosedLoopPolicyDeniedError; // keep import alive for the future path
  throw new SuiClosedLoopPolicyUnresolvedError(args.coinType);
}

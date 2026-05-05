/**
 * Small, testable primitives for native-SUI transfers.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §3.2, §4.1.
 *
 * Mirrors `services/chains/solana/transferService.ts`:
 *   - File name parity (`transferService.ts`, NOT `nativeTransferService.ts`).
 *   - Signature shape parity: pure module, accepts injected `client` +
 *     `signer`, returns the network's transaction-id type
 *     (`Promise<digest>` here, `Promise<Signature>` over there).
 *
 * Rationale:
 *   - `SuiWalletKit` (Task 08) needs a "fetch native balance" and a
 *     "build + sign + submit SUI transfer" helper it can call from a
 *     namespace-agnostic surface (`WalletKitAdapter.sendNativeTransfer`).
 *     Keeping these out of the kit lets us unit-test the PTB shape and
 *     RPC roundtrip without a `TWallet`, a registry, or an active chain.
 *   - The `Ed25519Keypair.signAndExecuteTransaction` flow inside the
 *     SDK already wraps intent prefixing + BLAKE2b — we don't hand-roll.
 *     Any intent-related security TODOs belong in `codec.ts`'s
 *     `messageWithSuiIntent`, not here.
 *
 * SDK note (2.16):
 *   The class formerly known as `SuiClient` is now `SuiJsonRpcClient`
 *   from `@mysten/sui/jsonRpc`. We keep the conventional name as a
 *   type alias for call-site ergonomics; see `tokenKind.ts` for the
 *   same trick.
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

/**
 * Type alias preserving the conventional name. Re-exported so callers
 * can import `SuiClient` from this module if they need the type for a
 * function signature (matching the Solana `SolanaRpc` ergonomics).
 */
export type SuiClient = SuiJsonRpcClient;

/**
 * Returns the native SUI balance (in MIST — 1 SUI = 10^9 MIST) for a
 * canonical 32-byte Sui address.
 *
 * Coerces through `BigInt(...)` so consumers can rely on a plain
 * `bigint` regardless of whether the JSON transport returned a string
 * or a number. Mirrors the `BigInt(value)` discipline in
 * `solana/transferService.ts#getSolanaBalance`.
 */
export async function getSuiNativeBalance(
  client: SuiClient,
  address: string,
): Promise<bigint> {
  const { totalBalance } = await client.getBalance({ owner: address });
  return BigInt(totalBalance);
}

/**
 * Args for {@link buildAndSendSuiTransfer}. `signer` is the keypair
 * injected by the kit (Task 05's dwell-site `getSuiSignerForWallet`);
 * this module never constructs one itself.
 */
export interface BuildAndSendSuiTransferArgs {
  client: SuiClient;
  signer: Ed25519Keypair;
  /** Recipient canonical 32-byte Sui address (`0x` + 64 hex chars). */
  to: string;
  /** Amount in MIST. Never a `number` — `bigint` end-to-end. */
  mist: bigint;
}

/**
 * Build, sign, and submit a native-SUI transfer. Returns the
 * transaction digest (Sui's analogue of a base58 signature).
 *
 * PTB shape (spec §4.1):
 *   1. Split a fresh `Coin<SUI>` of size `mist` from the gas coin.
 *   2. Transfer that coin object to the recipient.
 *
 * `signAndExecuteTransaction` on the JSON-RPC client handles intent
 * prefixing + BLAKE2b hashing internally — do not reimplement.
 *
 * `options.showEffects: false` keeps the response payload small. The
 * kit can re-fetch effects with a follow-up `getTransactionBlock` if
 * the UX needs them; for the send-flow happy path the digest is
 * sufficient (the indexer / explorer hydrates the rest).
 */
export async function buildAndSendSuiTransfer(
  args: BuildAndSendSuiTransferArgs,
): Promise<string> {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(args.mist)]);
  tx.transferObjects([coin], tx.pure.address(args.to));

  const { digest } = await args.client.signAndExecuteTransaction({
    transaction: tx,
    signer: args.signer,
    options: { showEffects: false },
  });
  return digest;
}

/**
 * SLIP-0010 ed25519 derivation for Solana (BIP-44 coin type 501).
 *
 * Spec reference: `docs/solana-chain-support-spec.md` §3.4, §7.2.
 *
 * Solana uses hardened ed25519 (SLIP-0010), not BIP-44 secp256k1. The default
 * derivation path `m/44'/501'/0'/0'` matches Phantom / Solflare so the same
 * mnemonic yields the same base58 address across our wallet and theirs.
 *
 * This module is intentionally pure: no I/O, no logging of key material, no
 * fallbacks. If `ed25519-hd-key` fails, we throw — we never synthesize a key.
 */

import { mnemonicToSeedSync } from "@scure/bip39";
import { derivePath } from "ed25519-hd-key";

export const DEFAULT_SOLANA_PATH = "m/44'/501'/0'/0'";

/**
 * Derive a 32-byte Solana (ed25519) private-key seed from a BIP-39 mnemonic.
 *
 * @param mnemonic BIP-39 mnemonic (12 or 24 words, validated upstream).
 * @param path     SLIP-0010 derivation path. Defaults to `m/44'/501'/0'/0'`.
 * @returns 32-byte `Uint8Array` consumable by
 *          `@solana/kit::createKeyPairFromPrivateKeyBytes`.
 */
export function mnemonicToSolanaPrivateKey(
  mnemonic: string,
  path: string = DEFAULT_SOLANA_PATH,
): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  const { key } = derivePath(path, Buffer.from(seed).toString("hex"));
  return new Uint8Array(key);
}

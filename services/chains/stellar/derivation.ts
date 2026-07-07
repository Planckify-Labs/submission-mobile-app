/**
 * SLIP-0010 ed25519 derivation for Stellar (BIP-44 coin type 148).
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §1.2, §3.1, §3.2.
 *
 * Stellar uses hardened ed25519 (SLIP-0010) per SEP-0005, at the 3-level
 * fully-hardened "primary key" path `m/44'/148'/0'` — one level shallower
 * than Solana's `m/44'/501'/0'/0'` or Sui's `m/44'/784'/0'/0'/0'`, because
 * SEP-0005 itself stops at the account level (SLIP-0010 ed25519 forbids
 * non-hardened child derivation, so there's no change/address-index
 * level to append).
 *
 * This module reuses the in-repo SLIP-0010 walker from
 * `services/chains/solana/derivation.ts` rather than adding the
 * community `stellar-hd-wallet` package as a new dependency — the walker
 * is a generic path walker parameterized only by `path`; Stellar just
 * supplies a different path string and reads 3 hardened segments instead
 * of 4. Same "don't hand-roll a second SLIP-0010 implementation"
 * discipline the spec cites for Solana's own choice to avoid
 * `ed25519-hd-key` (which drags in Node's `stream` via `cipher-base` and
 * cannot run under Hermes).
 */

import { mnemonicToSeedSync } from "@scure/bip39";
import { derivePathSlip10Ed25519 } from "@/services/chains/solana/derivation";

export const DEFAULT_STELLAR_PATH = "m/44'/148'/0'";

/**
 * Derive a 32-byte Stellar (ed25519) secret-key seed from a BIP-39
 * mnemonic.
 *
 * @param mnemonic BIP-39 mnemonic (12 or 24 words, validated upstream).
 * @param path     SLIP-0010 derivation path. Defaults to `m/44'/148'/0'`.
 * @returns 32-byte `Uint8Array` consumable by
 *          `@stellar/stellar-base::Keypair.fromRawEd25519Seed`.
 */
export function mnemonicToStellarPrivateKey(
  mnemonic: string,
  path: string = DEFAULT_STELLAR_PATH,
): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  const { key } = derivePathSlip10Ed25519(seed, path);
  return new Uint8Array(key);
}

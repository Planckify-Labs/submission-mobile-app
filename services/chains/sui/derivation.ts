/**
 * SLIP-0010 ed25519 derivation for Sui (BIP-44 coin type 784).
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §1.4, §3.2, §6.
 *
 * Sui uses hardened ed25519 (SLIP-0010) with a 5-level fully-hardened path.
 * The default derivation path `m/44'/784'/0'/0'/0'` matches Sui Wallet,
 * Suiet, and Surf so the same mnemonic yields the same Sui address across
 * our wallet and theirs.
 *
 * This module is intentionally pure: no I/O, no logging of key material, no
 * fallbacks, no `Math.random`. It wraps `Ed25519Keypair.deriveKeypair` from
 * `@mysten/sui/keypairs/ed25519` directly — the SDK ships the canonical
 * SLIP-0010 walk, so we don't re-implement it here. SDK errors (invalid
 * mnemonic, malformed path) propagate verbatim.
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export const DEFAULT_SUI_PATH = "m/44'/784'/0'/0'/0'";

/**
 * Derive a Sui Ed25519 keypair from a BIP-39 mnemonic.
 *
 * @param mnemonic BIP-39 mnemonic (12 or 24 words, validated upstream).
 * @param path     SLIP-0010 derivation path. Defaults to `m/44'/784'/0'/0'/0'`.
 * @returns        `Ed25519Keypair` whose `.toSuiAddress()` returns the
 *                 0x-prefixed 64-hex-char Sui address.
 */
export function mnemonicToSuiKeypair(
  mnemonic: string,
  path: string = DEFAULT_SUI_PATH,
): Ed25519Keypair {
  return Ed25519Keypair.deriveKeypair(mnemonic, path);
}

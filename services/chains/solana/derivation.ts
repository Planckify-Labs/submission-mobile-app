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
 * fallbacks. The SLIP-0010 walk is implemented in-module against
 * `@noble/hashes` (HMAC-SHA512) to avoid `ed25519-hd-key`, which pulls in
 * Node's `stream` via `cipher-base` and cannot run under Hermes.
 */

import { mnemonicToSeedSync } from "@scure/bip39";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha2";

export const DEFAULT_SOLANA_PATH = "m/44'/501'/0'/0'";

const HARDENED_OFFSET = 0x80000000;
const MASTER_KEY = new TextEncoder().encode("ed25519 seed");

function derivePathSlip10Ed25519(
  seed: Uint8Array,
  path: string,
): { key: Uint8Array; chainCode: Uint8Array } {
  const I = hmac(sha512, MASTER_KEY, seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);

  const segments = path.split("/");
  if (segments.shift() !== "m") {
    throw new Error("SLIP-0010 path must start with 'm'");
  }

  for (const segment of segments) {
    if (!segment.endsWith("'")) {
      throw new Error(
        "SLIP-0010 ed25519 requires hardened derivation (all segments end with ')",
      );
    }
    const indexRaw = Number.parseInt(segment.slice(0, -1), 10);
    if (!Number.isInteger(indexRaw) || indexRaw < 0) {
      throw new Error(`Invalid SLIP-0010 path segment: ${segment}`);
    }
    const index = (indexRaw + HARDENED_OFFSET) >>> 0;
    const data = new Uint8Array(1 + 32 + 4);
    data[0] = 0x00;
    data.set(key, 1);
    data[33] = (index >>> 24) & 0xff;
    data[34] = (index >>> 16) & 0xff;
    data[35] = (index >>> 8) & 0xff;
    data[36] = index & 0xff;
    const h = hmac(sha512, chainCode, data);
    key = h.slice(0, 32);
    chainCode = h.slice(32);
  }

  return { key, chainCode };
}

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
  const { key } = derivePathSlip10Ed25519(seed, path);
  return new Uint8Array(key);
}

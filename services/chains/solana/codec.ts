/**
 * Solana encoding glue — base58 / base64 / transaction round-trip.
 *
 * Spec reference: `docs/solana-chain-support-spec.md` §6.1, §7.8.
 *
 * Rationale:
 *   - `TWallet.privateKey` carries base58-encoded bytes (Phantom export
 *     format). `SolanaSignTxPayload.transaction` arrives from the WebView
 *     as base64. The signer dwell site (Task 10) and the bridge signer
 *     (Task 17) both need small, non-allocating glue between those
 *     encodings and `@solana/kit`'s wire formats.
 *   - Centralising keeps encoding logic out of the dwell site — the fewer
 *     things that touch secret bytes, the better.
 *
 * Rules (non-negotiable, see task 08):
 *   - No `console.log` on `Uint8Array` arguments (secret material).
 *   - `Uint8Array`-first. No `Buffer` in the hot path beyond what `bs58`
 *     already does internally (Hermes parity).
 *   - `parseSolanaPrivateKey` MUST accept both 32-byte seed and 64-byte
 *     Phantom export (secret+pubkey) base58 forms, slicing the first 32
 *     bytes (the ed25519 seed half by convention — see §7.3 / §7.4).
 */

import type { Transaction } from "@solana/kit";
import {
  getBase64Decoder,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  getTransactionEncoder,
} from "@solana/kit";
import bs58 from "bs58";

/** Expected ed25519 seed length (private-key material). */
const ED25519_SEED_LEN = 32;
/** Phantom's "secret key" export is 64 bytes: 32-byte seed || 32-byte pubkey. */
const PHANTOM_SECRET_LEN = 64;

/** Convenience re-export so downstream modules don't have to pull kit directly. */
export type { Transaction } from "@solana/kit";

/**
 * Decode a base58 string to raw bytes.
 *
 * Thin wrapper over `bs58` so every consumer goes through one call site —
 * keeps the dependency surface auditable and makes it trivial to swap
 * implementations (e.g. Hermes-optimised variant) in a future pass.
 */
export function base58ToBytes(s: string): Uint8Array {
  return bs58.decode(s);
}

/**
 * Encode bytes to a base58 string. Mirror of {@link base58ToBytes}.
 */
export function bytesToBase58(b: Uint8Array): string {
  return bs58.encode(b);
}

/** Decode a base64 string (wire format from injected script) to raw bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  // kit's `getBase64Encoder().encode(str)` reads string → bytes.
  return getBase64Encoder().encode(b64) as Uint8Array;
}

/** Encode raw bytes to a base64 string (wire format the injected script b64-decodes). */
export function bytesToBase64(b: Uint8Array): string {
  return getBase64Decoder().decode(b);
}

/**
 * Decode a base64-encoded Solana wire transaction into a kit `Transaction`.
 *
 * Uses kit's `getBase64Encoder` (string -> bytes) and `getTransactionDecoder`
 * (bytes -> Transaction). This is the inverse of
 * {@link transactionToBase64}.
 */
export function base64ToTransaction(b64: string): Transaction {
  const bytes = getBase64Encoder().encode(b64);
  return getTransactionDecoder().decode(bytes);
}

/**
 * Encode a kit `Transaction` as a base64 wire-format string.
 *
 * Prefers kit's `getBase64EncodedWireTransaction` helper, which composes
 * `getTransactionEncoder().encode(tx)` + `getBase64Decoder().decode(...)`
 * internally. The return type is narrowed to `string` (the nominal
 * `Base64EncodedWireTransaction` brand collapses to string at the module
 * boundary — callers shouldn't care).
 */
export function transactionToBase64(tx: Transaction): string {
  return getBase64EncodedWireTransaction(tx);
}

/**
 * Parse a Phantom-style private-key string into a 32-byte ed25519 seed.
 *
 * Accepts:
 *   - 32-byte base58 (raw seed — what kit consumes directly).
 *   - 64-byte base58 (Phantom export — secret-key bytes followed by
 *     public-key bytes). We slice `[0, 32)` to recover the seed half.
 *     This matches the ed25519 convention where the signing key is the
 *     first 32 bytes of the 64-byte "secret key" form (cf. RFC 8032);
 *     the last 32 bytes are the derived public key which we reconstruct
 *     via `getAddressFromPublicKey` downstream.
 *
 * Throws a clear error for any other length so misrouted inputs fail
 * loud at the boundary instead of producing an invalid key downstream.
 */
export function parseSolanaPrivateKey(input: string): Uint8Array {
  const decoded = base58ToBytes(input);
  if (decoded.length === ED25519_SEED_LEN) {
    return decoded;
  }
  if (decoded.length === PHANTOM_SECRET_LEN) {
    // Phantom-format: first 32 bytes are the ed25519 seed.
    return decoded.slice(0, ED25519_SEED_LEN);
  }
  throw new Error(
    `Invalid Solana private key length: expected ${ED25519_SEED_LEN} or ${PHANTOM_SECRET_LEN} bytes, got ${decoded.length}`,
  );
}

/**
 * Thin wrapper over `@stellar/stellar-base`'s `StrKey` — SEP-0023 strkey
 * validation and the canonical G…/S… codec used everywhere else in the
 * Stellar chain support surface.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §1.2, §3.2.
 *
 * SEP-0023 requires implementations to reject any strkey whose length is
 * congruent to 1, 3, or 6 mod 8 before base-32 decoding, and to reject
 * any input that doesn't round-trip to the exact same string on
 * re-encode. `@stellar/stellar-base`'s `StrKey.decodeCheck` already
 * enforces the round-trip guard (throws on mismatch) — we don't
 * re-implement it here, same "don't hand-roll the SDK's validation
 * logic" discipline the spec applies to signing (§1.4).
 */

import { StrKey } from "@stellar/stellar-base";
import { Buffer } from "buffer";

/**
 * Validate a canonical Stellar account address (StrKey `G…`, ed25519
 * public key). Never throws — any malformed input returns `false`.
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address) return false;
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Validate a canonical Stellar secret seed (StrKey `S…`, ed25519 secret
 * seed — the private-key export format). Never throws.
 */
export function isValidStellarSecretSeed(secret: string): boolean {
  if (!secret) return false;
  try {
    return StrKey.isValidEd25519SecretSeed(secret);
  } catch {
    return false;
  }
}

/**
 * Thrown by {@link decodeStellarSecretSeed} when the input isn't a
 * valid StrKey `S…` secret seed. Mirrors
 * `InvalidSuiPrivateKeyEncodingError`'s "declared next to its codec"
 * placement (see `services/chains/sui/errorCodes.ts`'s note on that
 * decision) — migrate to `errorCodes.ts` only if a future caller needs a
 * shared `instanceof` check across multiple error types.
 */
export class InvalidStellarSecretSeedEncodingError extends Error {
  override readonly name = "InvalidStellarSecretSeedEncodingError";
  constructor() {
    super(
      "Invalid Stellar secret seed encoding (expected StrKey S… ed25519 secret seed)",
    );
  }
}

/**
 * Decode a canonical StrKey `S…` secret seed to its raw 32-byte payload.
 * Throws {@link InvalidStellarSecretSeedEncodingError} on any malformed
 * input rather than letting `@stellar/stellar-base`'s raw `Error`
 * propagate, so callers get one stable `name` to branch on.
 */
export function decodeStellarSecretSeed(secret: string): Buffer {
  try {
    return StrKey.decodeEd25519SecretSeed(secret);
  } catch {
    throw new InvalidStellarSecretSeedEncodingError();
  }
}

/**
 * Encode a raw 32-byte ed25519 seed to the canonical StrKey `S…` form.
 * Used to canonicalize an imported secret before storing it on
 * `TWallet.privateKey`, mirroring `encodeSuiPrivateKey`.
 */
export function encodeStellarSecretSeed(seed: Uint8Array): string {
  return StrKey.encodeEd25519SecretSeed(Buffer.from(seed));
}

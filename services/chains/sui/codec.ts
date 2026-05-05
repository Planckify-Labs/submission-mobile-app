/**
 * Sui encoding glue — bech32 / hex / base64 secret-key forms, address
 * derivation from a raw ed25519 public key, and intent-prefixed message
 * helpers.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §1.4, §1.5, §3.2.
 *
 * Rationale:
 *   - This module is the single source of truth for "is this string a Sui
 *     secret?" decisions. Every `TWallet.privateKey` for a Sui wallet
 *     flows through {@link decodeSuiPrivateKey} before reaching the
 *     keypair constructor, so accepted forms are pinned here and nowhere
 *     else.
 *   - The intent helpers (`messageWithSuiIntent`) wrap the SDK's
 *     `messageWithIntent` so call sites — Task 05 (`getSuiSignerForWallet`),
 *     Task 08 (`SuiWalletKit`), and the SuiAdapter dispatch (Task 12) —
 *     depend on this module rather than reaching into `@mysten/sui`
 *     directly. Mirrors the role of `services/chains/solana/codec.ts`.
 *
 * Rules (non-negotiable, see Task 13):
 *   - No `console.log` on `Uint8Array` arguments (secret material).
 *   - Pure exports; no I/O, no globals, no module-level secrets.
 *   - Legacy 20-byte addresses are rejected upstream in the send sheet
 *     (Task 14), NOT here. This module only handles secret-key + pubkey
 *     -> canonical-address encoding.
 */

import { fromBase64 } from "@mysten/bcs";
import {
  messageWithIntent,
  decodeSuiPrivateKey as sdkDecodeSuiPrivateKey,
  encodeSuiPrivateKey as sdkEncodeSuiPrivateKey,
} from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";

/** Expected ed25519 seed length (Sui private-key material). */
const ED25519_SEED_LEN = 32;

/** Bech32 HRP for Sui private keys (see SDK `SUI_PRIVATE_KEY_PREFIX`). */
const SUI_PRIVATE_KEY_BECH32_PREFIX = "suiprivkey1";

/**
 * Thrown when a string passed to {@link decodeSuiPrivateKey} does not
 * match any of the three supported encodings (bech32, hex, base64) or
 * decodes to the wrong length / signature scheme.
 *
 * TODO(task-07): move to errorCodes.ts and surface as INVALID_PARAMS at
 * the adapter boundary. Defined inline here so import paths
 * (`./codec`) stay stable when the migration happens.
 */
export class InvalidSuiPrivateKeyEncodingError extends Error {
  override name = "InvalidSuiPrivateKeyEncodingError";
  constructor(reason: string) {
    super(`Invalid Sui private key encoding: ${reason}`);
  }
}

/** Pattern for a 64-character hex string (32 bytes), case-insensitive. */
const HEX_64_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Decode a string-encoded Sui private key into the raw 32-byte ed25519
 * seed.
 *
 * Accepts (in priority order — first match wins):
 *
 *  1. **Bech32 `suiprivkey1…`** — the canonical Sui Wallet / Suiet
 *     export form. Delegates to the SDK's `decodeSuiPrivateKey`, then
 *     verifies `parsed.scheme === "ED25519"` and returns
 *     `parsed.secretKey`. Non-ed25519 schemes (Secp256k1, Secp256r1)
 *     are rejected here — Task 04 scope is ed25519 only.
 *
 *  2. **Raw 32-byte hex** — with or without `0x` prefix. Validated
 *     against {@link HEX_64_RE} after stripping the prefix, then
 *     hex-decoded to exactly 32 bytes.
 *
 *  3. **Base64 32-byte payload** — decoded via `@mysten/bcs`'s
 *     `fromBase64` (which is just `atob` + Uint8Array under the hood,
 *     Hermes-safe). Verified to be exactly 32 bytes.
 *
 * Throws {@link InvalidSuiPrivateKeyEncodingError} for anything else —
 * empty strings, wrong lengths, malformed bech32, or non-hex/non-base64
 * garbage. Errors carry a short reason fragment but never the input
 * string itself (it could be a real secret).
 */
export function decodeSuiPrivateKey(input: string): Uint8Array {
  if (typeof input !== "string" || input.length === 0) {
    throw new InvalidSuiPrivateKeyEncodingError("empty input");
  }

  // 1. Bech32 — the SDK validates HRP, checksum, length, and scheme flag.
  if (input.startsWith(SUI_PRIVATE_KEY_BECH32_PREFIX)) {
    let parsed: { scheme: string; secretKey: Uint8Array };
    try {
      parsed = sdkDecodeSuiPrivateKey(input);
    } catch (err) {
      throw new InvalidSuiPrivateKeyEncodingError(
        `malformed bech32: ${(err as Error).message}`,
      );
    }
    if (parsed.scheme !== "ED25519") {
      throw new InvalidSuiPrivateKeyEncodingError(
        `unsupported scheme ${parsed.scheme}, expected ED25519`,
      );
    }
    if (parsed.secretKey.length !== ED25519_SEED_LEN) {
      throw new InvalidSuiPrivateKeyEncodingError(
        `bech32 payload length ${parsed.secretKey.length}, expected ${ED25519_SEED_LEN}`,
      );
    }
    return parsed.secretKey;
  }

  // 2. Hex — accept either `0x...` or bare hex.
  const hexCandidate = input.startsWith("0x") ? input.slice(2) : input;
  if (HEX_64_RE.test(hexCandidate)) {
    return hexToBytes(hexCandidate);
  }

  // 3. Base64 — last resort. `fromBase64` throws on non-base64.
  let decoded: Uint8Array;
  try {
    decoded = fromBase64(input);
  } catch (err) {
    throw new InvalidSuiPrivateKeyEncodingError(
      `not bech32, hex, or base64: ${(err as Error).message}`,
    );
  }
  if (decoded.length !== ED25519_SEED_LEN) {
    throw new InvalidSuiPrivateKeyEncodingError(
      `base64 payload length ${decoded.length}, expected ${ED25519_SEED_LEN}`,
    );
  }
  return decoded;
}

/**
 * Encode a 32-byte ed25519 seed as a Sui bech32 `suiprivkey1…` string.
 *
 * Thin delegate over the SDK's `encodeSuiPrivateKey` with the scheme
 * pinned to `"ED25519"`. Used by storage/migration paths that need to
 * persist a wallet's secret in the canonical exportable form (Task 05,
 * Task 06).
 */
export function encodeSuiPrivateKey(seed: Uint8Array): string {
  if (seed.length !== ED25519_SEED_LEN) {
    throw new InvalidSuiPrivateKeyEncodingError(
      `seed length ${seed.length}, expected ${ED25519_SEED_LEN}`,
    );
  }
  return sdkEncodeSuiPrivateKey(seed, "ED25519");
}

/**
 * Derive a canonical `0x`-prefixed 64-hex-char Sui address from a raw
 * ed25519 public key.
 *
 * Wraps `Ed25519PublicKey.toSuiAddress()` so call sites depend on this
 * module rather than the SDK directly. The return shape matches Sui's
 * 32-byte / 64-hex address layout (`0x` + sha3-256 over `flag || pubkey`,
 * truncated). Legacy 20-byte addresses never originate here — they are
 * rejected upstream in the send sheet (Task 14).
 */
export function deriveSuiAddressFromPubkey(pubkey: Uint8Array): string {
  return new Ed25519PublicKey(pubkey).toSuiAddress();
}

/**
 * Domain-separated message bytes for a Sui signature.
 *
 * Sui requires every signed payload to be prefixed with a 3-byte intent
 * header (`scope || version || app_id`) before hashing. Skipping the
 * intent — or using the wrong scope — produces a signature the network
 * accepts as valid for a different purpose, which is the whole reason
 * intents exist.
 *
 * Maps the friendly local strings to the SDK's `IntentScope` discriminants:
 *   - `"transaction"` -> `"TransactionData"` (used by Task 08
 *     `signTransactionBlock`).
 *   - `"personal"`    -> `"PersonalMessage"` (used by Task 08
 *     `signPersonalMessage` and the SIWS path).
 */
export function messageWithSuiIntent(
  scope: "transaction" | "personal",
  bytes: Uint8Array,
): Uint8Array {
  const sdkScope =
    scope === "transaction" ? "TransactionData" : "PersonalMessage";
  return messageWithIntent(sdkScope, bytes);
}

/**
 * Hex-decode a 64-character (32-byte) hex string. Assumes the input has
 * already passed {@link HEX_64_RE} — caller's responsibility. Pulled
 * out as a standalone helper so the hot path stays branch-free.
 */
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(ED25519_SEED_LEN);
  for (let i = 0; i < ED25519_SEED_LEN; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

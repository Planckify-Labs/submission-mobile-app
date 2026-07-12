/**
 * Encrypts a BIP-39 mnemonic into the v1 backup blob and back.
 *
 * The ciphertext is uploaded to the user's own Drive `appDataFolder`. Neither
 * TakumiPay nor Google can decrypt it: the key exists only as the Argon2id
 * output of a passphrase that never leaves the device and is never persisted.
 *
 * See `docs/encrypted-seed-backup-spec.md`.
 */

// Imported through the `@/` alias, not `./primitives`, so `vitest.config.ts`
// can exact-match the specifier and substitute the Node twin. A relative
// specifier would resolve past the alias and drag the native module into the
// test process.
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKey,
  getRandomBytes,
} from "@/services/backup/primitives";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
} from "./bytes";
import type { Argon2Params, SeedBackupBlobV1 } from "./types";

/**
 * OWASP's Argon2id floor is m=19 MiB, t=2, p=1. We sit well above it because
 * the blob is offline-attackable by anyone who takes over the Google account:
 * there is no server to rate-limit their guessing. 64 MiB also prices GPU
 * attacks far worse than a time-only bump would.
 */
export const ARGON2_PARAMS: Argon2Params = {
  m: 65536, // 64 MiB
  t: 3,
  p: 1,
  dkLen: 32, // AES-256
};

const SALT_BYTES = 16;
const IV_BYTES = 12; // 96-bit nonce — the size GCM is specified for.

/**
 * The bytes fed to GCM as additional authenticated data.
 *
 * Everything the client would otherwise trust blindly goes in here: the
 * version and the KDF cost parameters. Without this, an attacker who can write
 * to the user's Drive could rewrite `m` from 65536 to 8, hand back a blob whose
 * ciphertext they never touched, and the client would happily derive a key
 * from a trivially brute-forceable KDF. Binding the header means any such edit
 * fails the tag check before a single byte is decrypted.
 *
 * Field order is fixed by construction, not by `JSON.stringify` of an object
 * literal, so a future key reordering can't silently invalidate old blobs.
 */
function buildAad(blob: Pick<SeedBackupBlobV1, "v" | "kdf" | "createdAt">) {
  const canonical = [
    `v=${blob.v}`,
    `alg=${blob.kdf.alg}`,
    `m=${blob.kdf.m}`,
    `t=${blob.kdf.t}`,
    `p=${blob.kdf.p}`,
    `salt=${blob.kdf.salt}`,
    `createdAt=${blob.createdAt}`,
  ].join("&");
  return utf8ToBytes(canonical);
}

/**
 * `params` is injectable so tests can use a cheap KDF. Production callers must
 * not pass it — the default is the policy. Everything the tests exercise (AAD
 * binding, tag verification, schema validation) is independent of cost.
 */
export async function encryptMnemonic(
  mnemonic: string,
  passphrase: string,
  params: Argon2Params = ARGON2_PARAMS,
): Promise<SeedBackupBlobV1> {
  const salt = getRandomBytes(SALT_BYTES);
  const iv = getRandomBytes(IV_BYTES);
  const createdAt = Date.now();

  const header = {
    v: 1 as const,
    kdf: {
      alg: "argon2id" as const,
      m: params.m,
      t: params.t,
      p: params.p,
      salt: bytesToBase64(salt),
    },
    createdAt,
  };

  const key = await deriveKey(utf8ToBytes(passphrase), salt, params);
  const { ciphertext, tag } = aesGcmEncrypt(
    key,
    iv,
    utf8ToBytes(mnemonic),
    buildAad(header),
  );

  return {
    ...header,
    cipher: {
      alg: "aes-256-gcm",
      iv: bytesToBase64(iv),
      ct: bytesToBase64(ciphertext),
      tag: bytesToBase64(tag),
    },
  };
}

/** Thrown when the blob is structurally unusable — distinct from a bad passphrase. */
export class CorruptBackupError extends Error {
  constructor() {
    super("corrupt_backup");
    this.name = "CorruptBackupError";
  }
}

/** Thrown when GCM rejects the tag: wrong passphrase, or the blob was tampered with. */
export class WrongPassphraseError extends Error {
  constructor() {
    super("wrong_passphrase");
    this.name = "WrongPassphraseError";
  }
}

export function isSeedBackupBlobV1(value: unknown): value is SeedBackupBlobV1 {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (b.v !== 1 || typeof b.createdAt !== "number") return false;

  const kdf = b.kdf as Record<string, unknown> | undefined;
  if (
    !kdf ||
    kdf.alg !== "argon2id" ||
    typeof kdf.m !== "number" ||
    typeof kdf.t !== "number" ||
    typeof kdf.p !== "number" ||
    typeof kdf.salt !== "string"
  ) {
    return false;
  }

  const cipher = b.cipher as Record<string, unknown> | undefined;
  return (
    !!cipher &&
    cipher.alg === "aes-256-gcm" &&
    typeof cipher.iv === "string" &&
    typeof cipher.ct === "string" &&
    typeof cipher.tag === "string"
  );
}

/**
 * `minParams` is the weakest KDF this client will spend time on. Injectable for
 * the same reason as {@link encryptMnemonic}; production callers take the default.
 */
export async function decryptMnemonic(
  blob: unknown,
  passphrase: string,
  minParams: Argon2Params = ARGON2_PARAMS,
): Promise<string> {
  if (!isSeedBackupBlobV1(blob)) throw new CorruptBackupError();

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  let tag: Uint8Array;
  try {
    salt = base64ToBytes(blob.kdf.salt);
    iv = base64ToBytes(blob.cipher.iv);
    ciphertext = base64ToBytes(blob.cipher.ct);
    tag = base64ToBytes(blob.cipher.tag);
  } catch {
    throw new CorruptBackupError();
  }

  // Honour the blob's own cost parameters so a blob written by a future
  // version with stronger settings still opens. They're covered by the AAD, so
  // a downgraded value cannot survive the tag check below — but refuse
  // outright anything weaker than today's floor rather than spend a minute
  // deriving a key we'd then have to reject.
  if (blob.kdf.m < minParams.m || blob.kdf.t < minParams.t) {
    throw new CorruptBackupError();
  }

  const key = await deriveKey(utf8ToBytes(passphrase), salt, {
    m: blob.kdf.m,
    t: blob.kdf.t,
    p: blob.kdf.p,
    dkLen: minParams.dkLen,
  });

  const aad = buildAad({ v: blob.v, kdf: blob.kdf, createdAt: blob.createdAt });

  let plaintext: Uint8Array;
  try {
    plaintext = aesGcmDecrypt(key, iv, ciphertext, tag, aad);
  } catch {
    // GCM cannot tell "wrong key" from "tampered ciphertext" — and neither
    // should we, to the user. Both mean: this passphrase didn't open it.
    throw new WrongPassphraseError();
  }

  return bytesToUtf8(plaintext);
}

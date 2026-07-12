/**
 * Crypto primitives for the seed backup, bound to the React Native runtime.
 *
 * Everything here comes from `react-native-quick-crypto`, which is already a
 * dependency and already `install()`-ed in `pollyfills.ts`. Argon2 and AES-GCM
 * are native (Nitro), so the memory-hard KDF runs in well under a second on a
 * mid-range device instead of the many seconds a pure-JS Argon2 would take
 * under Hermes.
 *
 * Vitest aliases this module to `primitives.node.ts`, which implements the
 * same four functions against `node:crypto` + `@noble/hashes`. The envelope in
 * `seedBackupCrypto.ts` therefore never imports a native module directly and
 * stays testable. See `docs/encrypted-seed-backup-spec.md` §4.
 */
import QuickCrypto, {
  argon2,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "react-native-quick-crypto";
import type { Argon2Params } from "./types";

/**
 * quick-crypto's `setAAD` / `setAuthTag` want its own Buffer
 * (`@craftzdog/react-native-buffer`), not a bare `Uint8Array`. Convert at the
 * boundary and keep `Uint8Array` as this module's public currency, so the
 * envelope never has to reason about which Buffer implementation is in scope
 * — the ambiguity behind the Hermes base64 corruption we hit before.
 */
const toBuf = (bytes: Uint8Array) => QuickCrypto.Buffer.from(bytes);

export function getRandomBytes(length: number): Uint8Array {
  return new Uint8Array(randomBytes(length));
}

/**
 * Argon2id. Async on purpose: at 64 MiB / 3 passes the sync variant would
 * block the JS thread long enough to drop frames on the sheet that calls it.
 */
export function deriveKey(
  passphrase: Uint8Array,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: passphrase,
        nonce: salt,
        memory: params.m,
        passes: params.t,
        parallelism: params.p,
        tagLength: params.dkLen,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(new Uint8Array(result));
      },
    );
  });
}

export function aesGcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): { ciphertext: Uint8Array; tag: Uint8Array } {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(toBuf(aad));
  const head = cipher.update(toBuf(plaintext));
  const tail = cipher.final();
  const ciphertext = concat(new Uint8Array(head), new Uint8Array(tail));
  return { ciphertext, tag: new Uint8Array(cipher.getAuthTag()) };
}

/** Throws when the tag does not verify — a wrong passphrase or a tampered blob. */
export function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(toBuf(aad));
  decipher.setAuthTag(toBuf(tag));
  const head = decipher.update(toBuf(ciphertext));
  const tail = decipher.final();
  return concat(new Uint8Array(head), new Uint8Array(tail));
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

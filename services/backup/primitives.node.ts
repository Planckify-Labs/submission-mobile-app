/**
 * Node twin of `primitives.ts`, used only under Vitest (aliased in
 * `vitest.config.ts`). `react-native-quick-crypto` is a Nitro native module and
 * cannot load outside the app runtime.
 *
 * This is real Argon2id and real AES-256-GCM, not a stub — so the envelope
 * tests exercise the actual cryptographic behavior (tag verification, AAD
 * binding) rather than a fake that always agrees with itself.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { argon2idAsync } from "@noble/hashes/argon2";
import type { Argon2Params } from "./types";

export function getRandomBytes(length: number): Uint8Array {
  return new Uint8Array(randomBytes(length));
}

export async function deriveKey(
  passphrase: Uint8Array,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<Uint8Array> {
  return argon2idAsync(passphrase, salt, {
    m: params.m,
    t: params.t,
    p: params.p,
    dkLen: params.dkLen,
  });
}

export function aesGcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): { ciphertext: Uint8Array; tag: Uint8Array } {
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const head = cipher.update(plaintext);
  const tail = cipher.final();
  return {
    ciphertext: new Uint8Array(Buffer.concat([head, tail])),
    tag: new Uint8Array(cipher.getAuthTag()),
  };
}

export function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const head = decipher.update(ciphertext);
  const tail = decipher.final();
  return new Uint8Array(Buffer.concat([head, tail]));
}

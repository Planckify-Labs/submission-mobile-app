/**
 * Byte <-> string helpers for the seed-backup envelope.
 *
 * Deliberately `btoa`/`atob` based rather than `Buffer#toString("base64")`.
 * A dependency in this app once allocated through the ambient global `Buffer`
 * and produced comma-joined garbage under Hermes with no thrown error — the
 * failure was silent and only visible on device. The blob these helpers encode
 * is the only copy of a user's seed, so the encoding path must be one we own.
 *
 * The blob is a few hundred bytes, so the naive per-byte loop is fine; it also
 * avoids `String.fromCharCode(...spread)` blowing the call stack.
 */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Constant-time-ish equality. Used on nothing security-critical today (GCM's
 * tag check happens inside the cipher), but keeps a timing-safe comparison at
 * hand for callers that need one.
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

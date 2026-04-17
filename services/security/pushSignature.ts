// TWV-2026-054 — signed push notifications. The wallet must NOT route
// signature deeplinks (or any "tap to approve" CTA) from a push body
// unless the body carries an HMAC over `(notification_id, deeplink,
// expires_at)` produced by a key the wallet trusts.
//
// This module is the verifier. The signing key + delivery happen
// server-side; this side only verifies and rejects loud.

import { hexToBytes } from "viem";

export type PushVerdict =
  | { ok: true }
  | {
      ok: false;
      code: "missing_fields" | "expired" | "bad_signature";
      message: string;
    };

export interface SignedPushPayload {
  /** Server-allocated notification id, included in the HMAC. */
  notificationId: string;
  /** The deeplink the notification taps to. */
  deeplink: string;
  /** Epoch-ms expiry; reject after this. */
  expiresAt: number;
  /** Hex HMAC-SHA256(serverKey, `${id}|${deeplink}|${expiresAt}`). */
  signatureHex: string;
}

async function hmacSha256(
  keyBytes: Uint8Array,
  message: string,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto subtle missing");
  const key = await subtle.importKey(
    "raw",
    new Uint8Array(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Verify a signed push payload. The shared key is provisioned at
 * install time (e.g. during SIWE auth completion); rotation is a
 * follow-up.
 */
export async function verifySignedPush(
  payload: SignedPushPayload,
  sharedKeyHex: string,
): Promise<PushVerdict> {
  if (
    !payload.notificationId ||
    !payload.deeplink ||
    typeof payload.expiresAt !== "number" ||
    !payload.signatureHex
  ) {
    return {
      ok: false,
      code: "missing_fields",
      message: "push payload missing required fields",
    };
  }
  if (Date.now() > payload.expiresAt) {
    return {
      ok: false,
      code: "expired",
      message: "push notification expired",
    };
  }
  const message = `${payload.notificationId}|${payload.deeplink}|${payload.expiresAt}`;
  const keyBytes = hexToBytes(sharedKeyHex as `0x${string}`);
  const expected = await hmacSha256(keyBytes, message);
  let received: Uint8Array;
  try {
    received = hexToBytes(payload.signatureHex as `0x${string}`);
  } catch {
    return { ok: false, code: "bad_signature", message: "signature not hex" };
  }
  if (!constantTimeEqual(expected, received)) {
    return {
      ok: false,
      code: "bad_signature",
      message: "HMAC mismatch — push not signed by trusted key",
    };
  }
  return { ok: true };
}

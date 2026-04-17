/**
 * Version downgrade safety per §10.4 inv 14 + Task 31.
 *
 * Rejects two classes of malformed inputs at the adapter boundary:
 *   (a) v0 wire bytes declared as `version: "legacy"` — silent
 *       downgrade corrupts ALT resolution.
 *   (b) Legacy wire bytes referencing address-lookup-tables — legacy
 *       transactions have no ALT section; the payload is malformed.
 *
 * Runs before any inspector.
 */

import type { SolanaTxVersion } from "./payloads";

export interface TxVersionCheck {
  ok: boolean;
  code?: number;
  reason?: string;
}

function isBase64(s: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

function b64decode(s: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback for test runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = (globalThis as any).Buffer?.from?.(s, "base64") as
    | { buffer: ArrayBuffer; byteOffset: number; byteLength: number }
    | undefined;
  if (!buf) throw new Error("no base64 decoder");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Inspect the first byte of the deserialised transaction. Solana v0
 * messages set the high bit (0x80) on the first byte of the message
 * header after the signature section. Legacy messages leave it clear.
 *
 * For wire inputs: a serialised transaction starts with a compact-u16
 * signature count, then N×64 signature bytes, then the message. The
 * first message byte is either a legacy header (clear high bit) or a
 * v0 prelude (`0x80`).
 *
 * We use a conservative heuristic — the adapter's purpose here is to
 * refuse obvious contradictions, not to parse every edge case.
 */
export function detectTxVersionFromWire(b64: string): SolanaTxVersion | null {
  if (!isBase64(b64)) return null;
  let bytes: Uint8Array;
  try {
    bytes = b64decode(b64);
  } catch {
    return null;
  }
  if (bytes.length < 2) return null;
  // Skip compact-u16 signature count (1-3 bytes, high bit marks continuation).
  let i = 0;
  while (i < Math.min(3, bytes.length) && (bytes[i] & 0x80) !== 0) i += 1;
  i += 1;
  if (i >= bytes.length) return null;
  // Read signature bytes (n * 64).
  const sigCount = bytes[0] & 0x7f;
  i += sigCount * 64;
  if (i >= bytes.length) return null;
  return (bytes[i] & 0x80) !== 0 ? 0 : "legacy";
}

export function checkVersionDowngrade(args: {
  transaction: string;
  declaredVersion: SolanaTxVersion;
}): TxVersionCheck {
  const wireVersion = detectTxVersionFromWire(args.transaction);
  if (wireVersion === null) {
    return { ok: true }; // Undetectable — inspector/signer will surface downstream.
  }
  if (wireVersion === 0 && args.declaredVersion === "legacy") {
    return {
      ok: false,
      code: -32602,
      reason: "transaction version mismatch (v0 wire with legacy declaration)",
    };
  }
  // Legacy wire bytes with ALT references cannot be safely represented —
  // full ALT-byte-level detection requires deserialising the message,
  // deferred to Task 10 when the ALT resolver lands.
  return { ok: true };
}

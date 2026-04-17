/**
 * Minimal Solana wire-format transaction parser.
 *
 * Parses the structural skeleton of a base64-encoded v0 / legacy tx:
 *   - signature count (we skip the bytes)
 *   - version byte + message header
 *   - account keys (base58-encoded)
 *   - recent blockhash
 *   - instructions (programIdIndex + account-index list + data bytes)
 *   - (v0 only) address table lookups
 *
 * We don't validate CPI, signature integrity, or budget — the point is
 * to surface the structural data the adapter / inspector / agent needs
 * to reason about intent. Anything more is `@solana/kit`'s job at
 * execute time.
 *
 * Agent-readiness: populates `payload.decoded` + `payload.feePayer` +
 * `payload.altReferences` on the intent, which the Takumi AI inspector
 * can walk without re-parsing the tx itself.
 */

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--)
    result += BASE58.charAt(digits[i]);
  return result;
}

function b64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = (globalThis as any).Buffer?.from?.(b64, "base64");
  if (!buf) throw new Error("no base64 decoder");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

class Cursor {
  readonly bytes: Uint8Array;
  offset: number;

  constructor(bytes: Uint8Array, offset = 0) {
    this.bytes = bytes;
    this.offset = offset;
  }

  u8(): number {
    return this.bytes[this.offset++] ?? 0;
  }

  compactU16(): number {
    let value = 0;
    let shift = 0;
    for (let i = 0; i < 3; i++) {
      const byte = this.u8();
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return value;
      shift += 7;
    }
    return value;
  }

  slice(n: number): Uint8Array {
    const out = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  remaining(): number {
    return this.bytes.length - this.offset;
  }
}

export interface ParsedInstruction {
  programId: string;
  /** base58 account addresses this ix touches (writable/readonly preserved by index order). */
  accounts: string[];
  /** Raw instruction data bytes. */
  data: Uint8Array;
}

export interface ParsedAltLookup {
  tableAddress: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

export interface ParsedTransaction {
  version: "legacy" | 0;
  /** Header byte counts — useful for writable-account analysis. */
  numRequiredSignatures: number;
  numReadonlySigned: number;
  numReadonlyUnsigned: number;
  /** Fee payer = staticAccountKeys[0]. */
  feePayer: string;
  /** Full static key list in wire order (base58). */
  accountKeys: string[];
  recentBlockhash: string;
  instructions: ParsedInstruction[];
  /** v0 only — static entries first, ALT entries appended per CAIP resolution order. */
  addressTableLookups: ParsedAltLookup[];
}

/**
 * Parse a base64 wire-format transaction. Returns null on malformed
 * input — callers render the base64 blob as opaque and skip the
 * decoded path.
 */
export function parseWireTransaction(b64: string): ParsedTransaction | null {
  let bytes: Uint8Array;
  try {
    bytes = b64ToBytes(b64);
  } catch {
    return null;
  }
  if (bytes.length < 64) return null;

  try {
    const c = new Cursor(bytes);
    // Signatures (count * 64 bytes) — we skip the bytes.
    const sigCount = c.compactU16();
    if (sigCount * 64 > c.remaining()) return null;
    c.offset += sigCount * 64;

    // Message header — peek first byte to detect v0.
    const first = c.u8();
    let version: "legacy" | 0;
    let numRequiredSignatures: number;
    if ((first & 0x80) !== 0) {
      // v0 — next 3 bytes are the header.
      version = 0;
      numRequiredSignatures = c.u8();
    } else {
      version = "legacy";
      numRequiredSignatures = first;
    }
    const numReadonlySigned = c.u8();
    const numReadonlyUnsigned = c.u8();

    // Account keys — compact-u16 + count × 32 bytes.
    const keyCount = c.compactU16();
    if (keyCount * 32 > c.remaining()) return null;
    const accountKeys: string[] = [];
    for (let i = 0; i < keyCount; i++) {
      accountKeys.push(bytesToBase58(c.slice(32)));
    }

    // Recent blockhash (32 bytes).
    if (c.remaining() < 32) return null;
    const recentBlockhash = bytesToBase58(c.slice(32));

    // Instructions — compact-u16 + N instructions.
    const ixCount = c.compactU16();
    const instructions: ParsedInstruction[] = [];
    for (let i = 0; i < ixCount; i++) {
      if (c.remaining() < 1) return null;
      const programIdIndex = c.u8();
      const accountCount = c.compactU16();
      if (accountCount > c.remaining()) return null;
      const accountIndices = Array.from(c.slice(accountCount));
      const dataLen = c.compactU16();
      if (dataLen > c.remaining()) return null;
      const data = c.slice(dataLen);
      const programId = accountKeys[programIdIndex] ?? `?idx:${programIdIndex}`;
      instructions.push({
        programId,
        accounts: accountIndices.map(
          (idx) => accountKeys[idx] ?? `?idx:${idx}`,
        ),
        data,
      });
    }

    // v0 only — address table lookups.
    const addressTableLookups: ParsedAltLookup[] = [];
    if (version === 0 && c.remaining() > 0) {
      const altCount = c.compactU16();
      for (let i = 0; i < altCount; i++) {
        if (c.remaining() < 32) break;
        const table = bytesToBase58(c.slice(32));
        const wCount = c.compactU16();
        if (wCount > c.remaining()) break;
        const writable = Array.from(c.slice(wCount));
        const rCount = c.compactU16();
        if (rCount > c.remaining()) break;
        const readonly = Array.from(c.slice(rCount));
        addressTableLookups.push({
          tableAddress: table,
          writableIndexes: writable,
          readonlyIndexes: readonly,
        });
      }
    }

    const feePayer = accountKeys[0] ?? "";
    return {
      version,
      numRequiredSignatures,
      numReadonlySigned,
      numReadonlyUnsigned,
      feePayer,
      accountKeys,
      recentBlockhash,
      instructions,
      addressTableLookups,
    };
  } catch {
    return null;
  }
}

/**
 * List of writable account addresses per the account-keys layout.
 * Writable = index less than `numRequiredSignatures - numReadonlySigned`
 * (signer-writable) or between `numRequiredSignatures` and
 * `(accountKeys.length - numReadonlyUnsigned)` (non-signer writable).
 */
export function writableAccounts(t: ParsedTransaction): string[] {
  const out: string[] = [];
  const signerWritableEnd = t.numRequiredSignatures - t.numReadonlySigned;
  const nonSignerWritableEnd = t.accountKeys.length - t.numReadonlyUnsigned;
  for (let i = 0; i < signerWritableEnd; i++) {
    out.push(t.accountKeys[i]);
  }
  for (let i = t.numRequiredSignatures; i < nonSignerWritableEnd; i++) {
    out.push(t.accountKeys[i]);
  }
  return out;
}

/** Signer addresses (both writable + readonly). */
export function signerAccounts(t: ParsedTransaction): string[] {
  return t.accountKeys.slice(0, t.numRequiredSignatures);
}

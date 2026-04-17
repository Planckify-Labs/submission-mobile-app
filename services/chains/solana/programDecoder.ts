/**
 * Program instruction decoder — Tier 1 tables per task 12 scope.
 *
 * Covers System / SPL Token / Token-2022 / ComputeBudget / Memo in the
 * first-party table. Stake / ATA / ALT / Metaplex decoders live in their
 * own modules (tasks 26–29) and register via `registerProgramDecoder`.
 *
 * The adapter uses this at Phase 1b simulation time to enrich the intent
 * payload with a `decoded` array that the sheet renders row-by-row.
 */

import type { SolanaDecodedInstruction } from "./payloads";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export interface RawInstruction {
  programId: string;
  accounts: string[];
  data: Uint8Array | string; // base64 or raw bytes
}

export interface ProgramDecoder {
  programId: string;
  programName: string;
  decode(ins: RawInstruction): SolanaDecodedInstruction | null;
}

const registry: Map<string, ProgramDecoder> = new Map();

export function registerProgramDecoder(d: ProgramDecoder): void {
  registry.set(d.programId, d);
}

function dataBytes(data: RawInstruction["data"]): Uint8Array {
  if (data instanceof Uint8Array) return data;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = (globalThis as any).Buffer?.from?.(data, "base64");
    if (buf) return new Uint8Array(buf);
  } catch {
    // fall through
  }
  if (typeof atob === "function") {
    const bin = atob(data);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  return new Uint8Array();
}

function readU64LE(u: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i++) v |= BigInt(u[offset + i] ?? 0) << BigInt(i * 8);
  return v;
}
function readU32LE(u: Uint8Array, offset: number): number {
  return (
    (u[offset] ?? 0) |
    ((u[offset + 1] ?? 0) << 8) |
    ((u[offset + 2] ?? 0) << 16) |
    ((u[offset + 3] ?? 0) << 24)
  );
}

// ---- System ----
registerProgramDecoder({
  programId: SYSTEM_PROGRAM,
  programName: "System",
  decode(ins) {
    const d = dataBytes(ins.data);
    const tag = d.length >= 4 ? readU32LE(d, 0) : -1;
    if (tag === 2) {
      // Transfer { lamports: u64 }
      return {
        program: "system",
        kind: "transfer",
        data: {
          lamports: readU64LE(d, 4),
          from: ins.accounts[0],
          to: ins.accounts[1],
        },
      };
    }
    if (tag === 0) {
      return {
        program: "system",
        kind: "createAccount",
        data: { from: ins.accounts[0], to: ins.accounts[1] },
      };
    }
    if (tag === 4) {
      return {
        program: "system",
        kind: "advanceNonce",
        data: { nonce: ins.accounts[0], authority: ins.accounts[2] },
      };
    }
    return null;
  },
});

// ---- SPL Token (tier 1 — surface common transfer/mint variants) ----
for (const [pid, name] of [
  [SPL_TOKEN, "spl-token" as const],
  [TOKEN_2022, "token-2022" as const],
]) {
  registerProgramDecoder({
    programId: pid,
    programName: name,
    decode(ins) {
      const d = dataBytes(ins.data);
      if (d.length < 1) return null;
      switch (d[0]) {
        case 3:
          return {
            program: name,
            kind: "Transfer",
            data: {
              source: ins.accounts[0],
              destination: ins.accounts[1],
              authority: ins.accounts[2],
              amount: readU64LE(d, 1),
            },
          };
        case 7:
          return {
            program: name,
            kind: "MintTo",
            data: {
              mint: ins.accounts[0],
              destination: ins.accounts[1],
              authority: ins.accounts[2],
              amount: readU64LE(d, 1),
            },
          };
        case 8:
          return {
            program: name,
            kind: "Burn",
            data: {
              account: ins.accounts[0],
              mint: ins.accounts[1],
              authority: ins.accounts[2],
              amount: readU64LE(d, 1),
            },
          };
        case 12:
          return {
            program: name,
            kind: "TransferChecked",
            data: {
              source: ins.accounts[0],
              mint: ins.accounts[1],
              destination: ins.accounts[2],
              authority: ins.accounts[3],
              amount: readU64LE(d, 1),
              decimals: d[9] ?? 0,
            },
          };
        case 17:
          return {
            program: name,
            kind: "SetAuthority",
            data: {
              account: ins.accounts[0],
              authority: ins.accounts[1],
            },
          };
        default:
          return { program: name, kind: `spl:${d[0]}`, data: { raw: true } };
      }
    },
  });
}

// ---- ComputeBudget ----
registerProgramDecoder({
  programId: COMPUTE_BUDGET,
  programName: "ComputeBudget",
  decode(ins) {
    const d = dataBytes(ins.data);
    if (d.length < 1) return null;
    if (d[0] === 2) {
      return {
        program: "compute-budget",
        kind: "setComputeUnitLimit",
        value: readU32LE(d, 1),
      };
    }
    if (d[0] === 3) {
      return {
        program: "compute-budget",
        kind: "setComputeUnitPrice",
        value: readU64LE(d, 1),
      };
    }
    return null;
  },
});

// ---- Memo ----
registerProgramDecoder({
  programId: MEMO_PROGRAM,
  programName: "Memo",
  decode(ins) {
    const d = dataBytes(ins.data);
    return {
      program: "memo",
      data: new TextDecoder().decode(d),
    };
  },
});

/** Top-level decode entry — dispatches by programId, falls through to
 *  a tagged `unknown` when no decoder is registered. */
export function decodeInstruction(
  ins: RawInstruction,
): SolanaDecodedInstruction {
  const d = registry.get(ins.programId);
  if (d) {
    const out = d.decode(ins);
    if (out) return out;
    return {
      program: d.programName,
      kind: "unknown",
      programName: d.programName,
    };
  }
  return {
    program: ins.programId,
    kind: "unknown",
    programName: undefined,
  };
}

/** Decode every instruction in a list; returns `SolanaDecodedInstruction[]`. */
export function decodeInstructions(
  ixs: RawInstruction[],
): SolanaDecodedInstruction[] {
  return ixs.map(decodeInstruction);
}

export const PROGRAM_IDS = {
  SYSTEM: SYSTEM_PROGRAM,
  SPL_TOKEN,
  TOKEN_2022,
  COMPUTE_BUDGET,
  MEMO: MEMO_PROGRAM,
};

// Side-effect import registers Stake / ATA / ALT / Metaplex decoders.
import "./programDecoders.extras";

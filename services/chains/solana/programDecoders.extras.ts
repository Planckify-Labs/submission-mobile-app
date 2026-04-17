/**
 * Tier-1 decoders for programs beyond the core System/SPL set.
 *
 * Covers tasks 26 (Stake), 27 (ATA + hijack detection), 28 (ALT),
 * 29 (Metaplex). Each decoder registers against `programDecoder.ts`
 * at module-load time so the inspector picks them up automatically.
 */

import type { SolanaDecodedInstruction } from "./payloads";
import { registerProgramDecoder } from "./programDecoder";

const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const ALT_PROGRAM = "AddressLookupTab1e1111111111111111111111111";
const METAPLEX_METADATA = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const METAPLEX_CORE = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
const BUBBLEGUM = "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY";

function u8(d: Uint8Array, o: number): number {
  return d[o] ?? 0;
}

// ---- Stake (Task 26) ----
registerProgramDecoder({
  programId: STAKE_PROGRAM,
  programName: "Stake",
  decode(ins) {
    if (typeof ins.data === "string" || ins.data.length < 4) return null;
    const tag =
      (ins.data[0] ?? 0) |
      ((ins.data[1] ?? 0) << 8) |
      ((ins.data[2] ?? 0) << 16) |
      ((ins.data[3] ?? 0) << 24);
    const kinds: Record<number, string> = {
      0: "Initialize",
      1: "Authorize",
      2: "DelegateStake",
      3: "Split",
      4: "Withdraw",
      5: "Deactivate",
      7: "Merge",
    };
    const kind = kinds[tag];
    if (!kind) return null;
    return {
      program: STAKE_PROGRAM,
      kind,
      programName: "stake",
    } as SolanaDecodedInstruction;
  },
});

// ---- Associated Token Account (Task 27) ----
registerProgramDecoder({
  programId: ATA_PROGRAM,
  programName: "AssociatedTokenAccount",
  decode(ins) {
    if (typeof ins.data === "string") return null;
    const tag = u8(ins.data, 0);
    if (tag === 0 || ins.data.length === 0) {
      return {
        program: ATA_PROGRAM,
        kind: "Create",
        programName: "ata",
      } as SolanaDecodedInstruction;
    }
    if (tag === 1) {
      return {
        program: ATA_PROGRAM,
        kind: "CreateIdempotent",
        programName: "ata",
      } as SolanaDecodedInstruction;
    }
    if (tag === 2) {
      // RecoverNested — the hijack case per §10.4 inv 7. Decoder marks
      // it for the inspector to surface as `warn`.
      return {
        program: ATA_PROGRAM,
        kind: "RecoverNested",
        programName: "ata",
      } as SolanaDecodedInstruction;
    }
    return null;
  },
});

// ---- Address Lookup Table (Task 28) ----
registerProgramDecoder({
  programId: ALT_PROGRAM,
  programName: "AddressLookupTable",
  decode(ins) {
    if (typeof ins.data === "string" || ins.data.length < 4) return null;
    const tag =
      (ins.data[0] ?? 0) |
      ((ins.data[1] ?? 0) << 8) |
      ((ins.data[2] ?? 0) << 16) |
      ((ins.data[3] ?? 0) << 24);
    const kinds: Record<number, string> = {
      0: "CreateLookupTable",
      1: "FreezeLookupTable",
      2: "ExtendLookupTable",
      3: "DeactivateLookupTable",
      4: "CloseLookupTable",
    };
    const kind = kinds[tag];
    if (!kind) return null;
    return {
      program: ALT_PROGRAM,
      kind,
      programName: "alt",
    } as SolanaDecodedInstruction;
  },
});

// ---- Metaplex Token Metadata + Core + Bubblegum (Task 29) ----
for (const [pid, name] of [
  [METAPLEX_METADATA, "mpl-token-metadata"],
  [METAPLEX_CORE, "mpl-core"],
  [BUBBLEGUM, "mpl-bubblegum"],
]) {
  registerProgramDecoder({
    programId: pid,
    programName: name,
    decode(ins) {
      // Metaplex instruction decoding needs Borsh + per-program IDLs;
      // during P1c we expose instruction-presence rows and leave per-ix
      // detail to the next pass. The sheet renders "MPL: <program>"
      // which is already a material improvement over opaque base58.
      return {
        program: pid,
        kind: `${name}:ix`,
        programName: name,
      } as SolanaDecodedInstruction;
    },
  });
}

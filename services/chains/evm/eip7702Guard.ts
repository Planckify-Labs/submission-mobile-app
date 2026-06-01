// TWV-2026-010 — EIP-7702 authorization guard. Pure logic kept out of
// `EvmAdapter.ts` so the allowlist + bytecode-sniff invariants are
// unit-testable without booting the full adapter.
//
// Hard rules (do NOT regress):
//   1. Delegate address MUST be on the compiled-in allowlist OR be the
//      zero address (revoke). Anything else fails at the signing
//      boundary, not just in the UI — a deeplink / agent / bridge
//      bypass cannot reach the key.
//   2. Bytecode prologue is sniffed before signing. `SELFDESTRUCT`
//      opcode (0xff) anywhere in the first 512 bytes triggers a
//      distinct rejection — known drainer pattern.
//   3. Zero-address authorisations (revoke) skip the bytecode check
//      because there is no contract to inspect; revoke MUST always
//      remain reachable so a user is never locked into a compromised
//      delegate.

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

// Compiled-in allowlist baseline. Extended at module load from the
// OTA-rotatable `EXPO_PUBLIC_EIP7702_ALLOWLIST` env var (comma-separated
// hex addresses, lowercased) per umkm-usdc-payout-spec §10 — governance
// approvals land via `eas update` instead of a store release. See
// `docs/eip7702-delegator-allowlist-spec.md` for the review flow.
// All addresses are normalized to lowercase.
const COMPILED_IN_DELEGATORS: ReadonlyArray<string> = [
  ZERO_ADDRESS, // revoke is always allowed
  "0x63c0c19a282a1b52b07dd5a65b58948a07dae32b", // MetaMask deterministic Smart Account delegator
];

function parseAllowlistEnv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[0-9a-f]{40}$/i.test(s));
}

export const AUTHORIZED_DELEGATORS: ReadonlySet<string> = new Set([
  ...COMPILED_IN_DELEGATORS,
  ...parseAllowlistEnv(process.env.EXPO_PUBLIC_EIP7702_ALLOWLIST),
]);

export type Eip7702Decision =
  | { ok: true }
  | {
      ok: false;
      code: "not_on_allowlist" | "selfdestruct" | "malformed";
      message: string;
    };

/**
 * Synchronous predicate — first gate. Bytecode-fetch happens
 * separately because it requires a network call.
 */
export function decideAuthorizationByAddress(
  delegator: string,
): Eip7702Decision {
  if (typeof delegator !== "string" || !/^0x[0-9a-f]{40}$/i.test(delegator)) {
    return {
      ok: false,
      code: "malformed",
      message: "delegator address malformed",
    };
  }
  const a = delegator.toLowerCase();
  if (a === ZERO_ADDRESS) return { ok: true }; // revoke
  if (!AUTHORIZED_DELEGATORS.has(a)) {
    return {
      ok: false,
      code: "not_on_allowlist",
      message: "delegator not on EIP-7702 allowlist",
    };
  }
  return { ok: true };
}

/**
 * Bytecode-prologue sniff. Returns `ok: false` if `SELFDESTRUCT` (0xff)
 * appears in the first 512 bytes — a common drainer prologue. Empty or
 * missing bytecode (EOA / CREATE3 with deferred deploy) is allowed
 * through; later phases (TWV-2026-011 simulation) will tighten this.
 */
export function decideAuthorizationByBytecode(
  bytecode: `0x${string}` | null | undefined,
): Eip7702Decision {
  if (!bytecode || bytecode === "0x") return { ok: true };

  const hex = bytecode.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  const scanLimit = Math.min(bytes.length, 512);
  let pc = 0;
  while (pc < scanLimit) {
    const opcode = bytes[pc];
    if (opcode === 0xff) {
      return {
        ok: false,
        code: "selfdestruct",
        message: "delegator bytecode contains SELFDESTRUCT in prologue",
      };
    }
    if (opcode >= 0x60 && opcode <= 0x7f) {
      const pushSize = opcode - 0x60 + 1;
      pc += 1 + pushSize;
    } else {
      pc += 1;
    }
  }
  return { ok: true };
}

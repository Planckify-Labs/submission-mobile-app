/**
 * Durable nonce detection per Task 23.
 *
 * A transaction whose first instruction is System program's
 * `AdvanceNonceAccount` (discriminant 4) is using a durable nonce
 * lifetime instead of a recent blockhash. Callers need to:
 *   - Skip the "blockhash expired" retry branch (nonces don't expire).
 *   - Render a nonce-authority mismatch warning if the authority in
 *     the instruction isn't the active wallet.
 *
 * This module exposes the boolean predicate + authority extraction.
 */

export interface DurableNonceInfo {
  isDurableNonce: boolean;
  nonceAccount?: string;
  authority?: string;
}

export interface ParsedFirstInstruction {
  programId: string;
  data: Uint8Array;
  accounts: string[];
}

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

export function detectDurableNonce(
  firstIx: ParsedFirstInstruction | null,
): DurableNonceInfo {
  if (!firstIx) return { isDurableNonce: false };
  if (firstIx.programId !== SYSTEM_PROGRAM) return { isDurableNonce: false };
  if (firstIx.data.length < 4) return { isDurableNonce: false };
  const tag =
    (firstIx.data[0] ?? 0) |
    ((firstIx.data[1] ?? 0) << 8) |
    ((firstIx.data[2] ?? 0) << 16) |
    ((firstIx.data[3] ?? 0) << 24);
  if (tag !== 4) return { isDurableNonce: false };
  return {
    isDurableNonce: true,
    nonceAccount: firstIx.accounts[0],
    authority: firstIx.accounts[2],
  };
}

export function buildNonceMismatchAnnotation(
  expected: string,
  got: string,
): {
  code: "nonce.authority-mismatch";
  severity: "danger";
  title: string;
  detail: string;
  source: "local";
} {
  return {
    code: "nonce.authority-mismatch",
    severity: "danger",
    title: "Nonce authority mismatch",
    detail: `The transaction advances a nonce owned by ${expected}, but the signer is ${got}. The transaction will fail.`,
    source: "local",
  };
}

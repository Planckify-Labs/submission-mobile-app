/**
 * Solana adapter error-code contract. Every error path from
 * `SolanaAdapter.handleRequest` / `executeApproval` MUST use one of
 * these codes (solana-adapter-spec.md §10.3). Anything outside this
 * set fails the §10.3 compliance test and CI.
 */

export const SOLANA_ERROR_CODES = {
  /** User pressed Reject in an approval sheet. */
  USER_REJECT: 4001,
  /** No grant / no active Solana wallet / SIWS address mismatch. */
  UNAUTHORIZED: 4100,
  /** Unknown method, unsupported feature key, legacy `window.solana.signIn`. */
  UNSUPPORTED: 4200,
  /** Active wallet deleted mid-flight. */
  DISCONNECTED: 4900,
  /** dApp targeted a cluster the user's wallet is not on. */
  CLUSTER_NOT_CONNECTED: 4901,
  /** Another approval from this origin already pending. */
  RESOURCE_UNAVAILABLE: -32002,
  /** Invalid params — malformed base64, CAIP-2, SIWS timing, N > 20, etc. */
  INVALID_PARAMS: -32602,
  /** Internal failure — RPC, signer missing, ALT resolve, blockhash expiry. */
  INTERNAL: -32603,
} as const;

export type SolanaErrorCode =
  (typeof SOLANA_ERROR_CODES)[keyof typeof SOLANA_ERROR_CODES];

const VALID: ReadonlySet<number> = new Set<number>(
  Object.values(SOLANA_ERROR_CODES),
);

/** Assert a code is part of the §10.3 contract. Throws if it is not. */
export function assertSolanaErrorCode(code: number): void {
  if (!VALID.has(code)) {
    throw new Error(
      `Solana adapter emitted non-contract error code ${code} — see §10.3`,
    );
  }
}

export function isSolanaContractCode(code: number): boolean {
  return VALID.has(code);
}

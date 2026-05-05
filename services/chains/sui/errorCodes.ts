/**
 * Sui adapter error-code contract. Every error path from
 * `SuiAdapter.handleRequest` / `executeApproval` MUST use one of these
 * codes (sui-dapp-bridge-spec.md §11; analogue of the Solana §10.3
 * compliance test). Anything outside this set fails the dispatch
 * compliance test and CI.
 *
 * Wallet Standard Sui does not define a chain-specific error code set —
 * EIP-1193 / JSON-RPC 2.0 codes are the contract dApps branch on. We
 * only list the codes the adapter actually emits.
 */

export const SUI_ERROR_CODES = {
  /** User pressed Reject in an approval sheet. */
  USER_REJECT: 4001,
  /**
   * No grant / no active Sui wallet / SIWS address mismatch / cross-namespace
   * trust rejection. §11 — an EVM grant must NOT silently authorise Sui.
   */
  UNAUTHORIZED: 4100,
  /** Active wallet deleted mid-flight. */
  DISCONNECTED: 4900,
  /** dApp targeted a network the user's wallet is not on. */
  CHAIN_NOT_CONNECTED: 4901,
  /** Method not found — fell off the dispatch table's default arm. */
  METHOD_NOT_FOUND: -32601,
  /** Unsupported feature key (e.g. legacy `window.sui` shim that doesn't exist). */
  UNSUPPORTED: 4200,
  /** Another approval from this origin already pending. */
  RESOURCE_UNAVAILABLE: -32002,
  /** Invalid params — malformed base64 BCS, bad SIWS timing, etc. */
  INVALID_PARAMS: -32602,
  /** Internal failure — RPC, signer missing, decoder explosion. */
  INTERNAL: -32603,
  /** Generic adapter error fallback. */
  GENERIC: -32000,
} as const;

export type SuiErrorCode =
  (typeof SUI_ERROR_CODES)[keyof typeof SUI_ERROR_CODES];

const VALID: ReadonlySet<number> = new Set<number>(
  Object.values(SUI_ERROR_CODES),
);

/** Assert a code is part of the contract. Throws if it is not. */
export function assertSuiErrorCode(code: number): void {
  if (!VALID.has(code)) {
    throw new Error(
      `Sui adapter emitted non-contract error code ${code} — see services/chains/sui/errorCodes.ts`,
    );
  }
}

export function isSuiContractCode(code: number): boolean {
  return VALID.has(code);
}

/**
 * Builds the JSON-RPC error shape the bridge emits. Keeping this in one
 * place prevents drift between adapter return values and how DappBridge
 * forwards the result.
 */
export function suiError(
  code: SuiErrorCode | number,
  message: string,
  data?: unknown,
): { code: number; message: string; data?: unknown } {
  const payload: { code: number; message: string; data?: unknown } = {
    code,
    message,
  };
  if (data !== undefined) payload.data = data;
  return payload;
}

// ── Typed transfer / token-kind errors (spec §4.1) ──────────────────
//
// These are the user-facing transfer errors thrown by tokenKind.ts,
// transferService.ts, and coinTransferService.ts. Each has a stable
// `name` string so executors / UI can branch by `err.name === "..."`
// without depending on class identity (which can drift across module
// reloads).

export class SuiUnsupportedTokenKindError extends Error {
  override readonly name = "SuiUnsupportedTokenKindError";
  readonly coinType: string;
  constructor(coinType: string) {
    super(`Unsupported Sui token kind for coinType=${coinType}`);
    this.coinType = coinType;
  }
}

export class SuiInsufficientCoinError extends Error {
  override readonly name = "SuiInsufficientCoinError";
  readonly coinType: string;
  constructor(coinType: string, message?: string) {
    super(message ?? `Insufficient Coin<T> balance for coinType=${coinType}`);
    this.coinType = coinType;
  }
}

export class SuiRegulatedCoinDeniedError extends Error {
  override readonly name = "SuiRegulatedCoinDeniedError";
  readonly coinType: string;
  override readonly cause: unknown;
  constructor(coinType: string, cause: unknown) {
    super(
      `Regulated coin transfer denied (deny list) for coinType=${coinType}`,
    );
    this.coinType = coinType;
    this.cause = cause;
  }
}

export class SuiClosedLoopPolicyDeniedError extends Error {
  override readonly name = "SuiClosedLoopPolicyDeniedError";
  readonly coinType: string;
  readonly tokenPolicyId: string;
  override readonly cause: unknown;
  constructor(coinType: string, tokenPolicyId: string, cause: unknown) {
    super(`Closed-loop policy rejected transfer for coinType=${coinType}`);
    this.coinType = coinType;
    this.tokenPolicyId = tokenPolicyId;
    this.cause = cause;
  }
}

export class SuiClosedLoopPolicyUnresolvedError extends Error {
  override readonly name = "SuiClosedLoopPolicyUnresolvedError";
  readonly coinType: string;
  constructor(coinType: string) {
    super(`Could not resolve TokenPolicy<T> for coinType=${coinType}`);
    this.coinType = coinType;
  }
}

export class UnsupportedSuiSchemeError extends Error {
  override readonly name = "UnsupportedSuiSchemeError";
  readonly scheme: string;
  constructor(scheme: string) {
    super(`Unsupported Sui signature scheme: ${scheme} (only ed25519 in v1)`);
    this.scheme = scheme;
  }
}

export class InvalidSuiAddressLegacyError extends Error {
  override readonly name = "InvalidSuiAddressLegacyError";
  readonly address: string;
  constructor(address: string) {
    super(
      `Address ${address} is a pre-mainnet 20-byte Sui address. Current Sui uses 32-byte addresses.`,
    );
    this.address = address;
  }
}

// `InvalidSuiPrivateKeyEncodingError` is currently declared inline in
// `services/chains/sui/codec.ts` (with a TODO to migrate here). Decision
// for Task 07: leave it where it is and avoid an import-path migration.
// Moving the class would force every call-site that imports from
// `./codec` to switch to `./errorCodes`, with no runtime benefit; the
// class identity and `name` string are already stable. If a future task
// has reason to centralise typed errors here (e.g. shared `instanceof`
// checks at a single boundary), migrate then with a re-export from
// `./codec` to keep existing imports working.

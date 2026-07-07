/**
 * Typed Stellar transfer / account-precondition errors.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §4.1.
 *
 * Mirrors the Sui pattern (`services/chains/sui/errorCodes.ts`): each
 * error has a stable `name` string so executors / UI can branch by
 * `err.name === "..."` without depending on class identity (which can
 * drift across module reloads). These map into
 * `services/agent-executors/types.ts#mapUnknownError` (§4.1) so
 * agent-mode failures surface curated `ExecutorErrorCode` reasons
 * instead of raw text (CLAUDE.md user-facing-errors rule).
 */

/**
 * `loadAccount` 404s for a source (the wallet's own) lookup — the
 * wallet itself has never received XLM and therefore doesn't exist on
 * the ledger yet (spec §1.3 — "Accounts must be created on-ledger
 * before they exist").
 */
export class StellarAccountNotFoundError extends Error {
  override readonly name = "StellarAccountNotFoundError";
  readonly address: string;
  constructor(address: string) {
    super(`Stellar account ${address} does not exist on the ledger yet`);
    this.address = address;
  }
}

/**
 * Destination has no ledger entry yet and the operation being attempted
 * isn't `createAccount` (e.g. a non-native asset payment, which cannot
 * be the first transfer to a new address — spec §3.5).
 */
export class StellarDestinationUnfundedError extends Error {
  override readonly name = "StellarDestinationUnfundedError";
  readonly address: string;
  constructor(address: string) {
    super(
      `Destination ${address} has no ledger entry yet — it must receive XLM (createAccount) first`,
    );
    this.address = address;
  }
}

/**
 * Destination exists but has no trustline to the asset being sent.
 * Surfaced BEFORE submission (via a pre-flight `hasTrustline` check,
 * §4.1) rather than letting the payment round-trip to Horizon just to
 * get `op_no_trust` back.
 */
export class StellarNoTrustlineError extends Error {
  override readonly name = "StellarNoTrustlineError";
  readonly address: string;
  readonly code: string;
  readonly issuer: string;
  constructor(address: string, code: string, issuer: string) {
    super(
      `${address} has no trustline to ${code}:${issuer} — recipient must establish a trustline first`,
    );
    this.address = address;
    this.code = code;
    this.issuer = issuer;
  }
}

/**
 * Establishing a trustline / sending would drop the source below its
 * minimum reserve balance (spec §1.3 — base reserve + subentry reserve
 * math, `accountState.ts#computeMinBalance`).
 */
export class StellarInsufficientReserveError extends Error {
  override readonly name = "StellarInsufficientReserveError";
  constructor(message?: string) {
    super(
      message ?? "Operation would drop the account below its minimum reserve",
    );
  }
}

/**
 * `createAccount`'s `startingBalance` is below the new account's own
 * minimum reserve (1 XLM baseline, spec §1.3 / §3.5).
 */
export class StellarInsufficientCreateAmountError extends Error {
  override readonly name = "StellarInsufficientCreateAmountError";
  readonly startingBalanceStroops: bigint;
  readonly minimumStroops: bigint;
  constructor(startingBalanceStroops: bigint, minimumStroops: bigint) {
    super(
      `startingBalance ${startingBalanceStroops} stroops is below the new account's minimum reserve of ${minimumStroops} stroops`,
    );
    this.startingBalanceStroops = startingBalanceStroops;
    this.minimumStroops = minimumStroops;
  }
}

/**
 * `tx_bad_seq` — another submission consumed the sequence number first
 * (e.g. a rapid double-tap). UX should retry with a freshly reloaded
 * account, not surface a raw code (spec §4.1).
 */
export class StellarSequenceNumberRaceError extends Error {
  override readonly name = "StellarSequenceNumberRaceError";
  constructor() {
    super(
      "Transaction sequence number was consumed by another submission — reload the account and retry",
    );
  }
}

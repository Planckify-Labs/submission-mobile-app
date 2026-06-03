/**
 * `x402SpendLedger` — local running-total of x402 spend per allowance
 * (spec Phase 5 §5.4, §6.2, goal G4).
 *
 * The on-chain caveat (`erc20TransferAmount` / `erc20PeriodTransfer`) is
 * the cryptographic ceiling (SI-1); this ledger is the *local* accounting
 * that drives the silent-vs-prompt UX decision: settle silently while the
 * running total fits the cap, escalate to a top-up sheet when it doesn't.
 *
 * Scoped per `(wallet, delegationSalt)` — mirroring how
 * `PermissionGrantStore` is wallet-scoped — so allowances never bleed
 * across wallets or across re-signed delegations. Persisted in
 * SecureStore alongside the grant; all numeric fields are JSON-safe
 * decimal strings (bigint is not JSON-serialisable).
 *
 * Pure + injectable storage adapter so it runs under `node:test` with an
 * in-memory mock and never touches `expo-secure-store`.
 */

/**
 * Minimal async key/value interface (same shape as
 * `PermissionGrantStore.GrantStorageAdapter`) so the ledger can be unit-
 * tested without the native SecureStore module.
 */
export interface SpendStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/** Lazily-loaded default adapter backed by `expo-secure-store`. */
let secureStoreAdapterSingleton: SpendStorageAdapter | null = null;
function getSecureStoreAdapter(): SpendStorageAdapter {
  if (secureStoreAdapterSingleton) return secureStoreAdapterSingleton;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore =
    require("expo-secure-store") as typeof import("expo-secure-store");
  secureStoreAdapterSingleton = {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  };
  return secureStoreAdapterSingleton;
}

const STORAGE_KEY_PREFIX = "x402_spend_";

function storageKeyFor(wallet: string, salt: string): string {
  return `${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}_${salt.toLowerCase()}`;
}

/**
 * Persisted ledger blob. `spentAtoms` is the cumulative spend; for a
 * periodic allowance `periodStartSec` records when the current window
 * opened so `remaining()` can reset it when the window rolls over.
 */
interface LedgerBlob {
  spentAtoms: string;
  periodStartSec?: number;
}

export interface X402SpendLedgerOptions {
  /**
   * Recurring allowance config (`erc20PeriodTransfer`). When present,
   * `remaining()` resets the running total once `periodDurationSec` has
   * elapsed since `periodStartSec` and caps against `periodAmount`
   * instead of the lifetime cap (spec §4.5, G6).
   */
  period?: { periodAmount: bigint; periodDurationSec: number };
  /** Overridable clock (unix seconds) for deterministic tests. */
  nowSec?: () => number;
}

export class X402SpendLedger {
  private readonly wallet: string;
  private readonly salt: string;
  private readonly adapter: SpendStorageAdapter;
  private readonly period?: X402SpendLedgerOptions["period"];
  private readonly nowSec: () => number;
  private blob: LedgerBlob = { spentAtoms: "0" };
  private loadPromise: Promise<void>;
  private persistTail: Promise<void> = Promise.resolve();

  constructor(
    wallet: string,
    delegationSalt: string,
    adapter?: SpendStorageAdapter,
    options: X402SpendLedgerOptions = {},
  ) {
    this.wallet = wallet;
    this.salt = delegationSalt;
    this.adapter = adapter ?? getSecureStoreAdapter();
    this.period = options.period;
    this.nowSec = options.nowSec ?? (() => Math.floor(Date.now() / 1000));
    this.loadPromise = this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const raw = await this.adapter.getItem(
        storageKeyFor(this.wallet, this.salt),
      );
      if (raw) {
        const parsed = JSON.parse(raw) as LedgerBlob;
        if (parsed && typeof parsed.spentAtoms === "string") {
          this.blob = parsed;
        }
      }
    } catch {
      this.blob = { spentAtoms: "0" };
    }
  }

  /** Resolves when the initial hydrate from storage has completed. */
  whenLoaded(): Promise<void> {
    return this.loadPromise;
  }

  /** Resolves when all pending persistence writes have flushed. */
  flushed(): Promise<void> {
    return this.persistTail;
  }

  private schedulePersist(): void {
    const snapshot = JSON.stringify(this.blob);
    this.persistTail = this.persistTail.then(async () => {
      try {
        await this.adapter.setItem(
          storageKeyFor(this.wallet, this.salt),
          snapshot,
        );
      } catch {
        // Best-effort — a persist miss only loses local accounting; the
        // on-chain caveat still bounds the real spend (SI-1).
      }
    });
  }

  /**
   * Rolls the period window forward if it has elapsed, zeroing the
   * running total. No-op for non-periodic allowances. Mutates + persists
   * when a roll happens so a later `record()` accrues against the fresh
   * window.
   */
  private rollPeriodIfNeeded(): void {
    if (!this.period) return;
    const now = this.nowSec();
    if (this.blob.periodStartSec === undefined) {
      this.blob.periodStartSec = now;
      this.schedulePersist();
      return;
    }
    if (now - this.blob.periodStartSec >= this.period.periodDurationSec) {
      this.blob = { spentAtoms: "0", periodStartSec: now };
      this.schedulePersist();
    }
  }

  /** Cumulative spend recorded against the current window, in atoms. */
  getSpent(): bigint {
    this.rollPeriodIfNeeded();
    try {
      return BigInt(this.blob.spentAtoms);
    } catch {
      return 0n;
    }
  }

  /**
   * Remaining spendable atoms given the allowance cap. For a periodic
   * allowance the effective cap is `period.periodAmount`; otherwise it is
   * the lifetime `capAtoms` passed in. Never returns negative.
   */
  remaining(capAtoms: bigint): bigint {
    const effectiveCap = this.period ? this.period.periodAmount : capAtoms;
    const left = effectiveCap - this.getSpent();
    return left > 0n ? left : 0n;
  }

  /** Accrue `atoms` against the running total and persist (SI-1 ledger). */
  record(atoms: bigint): void {
    if (atoms <= 0n) return;
    this.rollPeriodIfNeeded();
    const next = this.getSpent() + atoms;
    this.blob = {
      spentAtoms: next.toString(),
      ...(this.period && this.blob.periodStartSec !== undefined
        ? { periodStartSec: this.blob.periodStartSec }
        : {}),
    };
    this.schedulePersist();
  }
}

/**
 * Permission Grant store for the Takumi Agent.
 *
 * Implements the data model, persistence, and `resolveGrant()` resolver
 * described in `AGENT_PROTOCOL.md` §6 "Permission Grants & Trust Delegation".
 *
 * Grants are stored locally on the device (SecureStore — matches the
 * wallet-key storage pattern in `services/walletService.ts`) and are
 * wallet-scoped: a grant for wallet A must not apply to wallet B.
 *
 * The public API is synchronous to match the spec; persistence happens
 * fire-and-forget on a serialized tail promise so writes cannot interleave.
 * Tests and app-launch code can await `store.whenLoaded()` / `store.flushed()`
 * if they need to observe persistence state.
 */

import type { DelegationStruct } from "./walletKit/types.ts";

// --- Types ------------------------------------------------------------------

/**
 * Mirrors the server-side `TOOL_REGISTRY` capability type. Defined locally
 * because the agent-api registry is not importable from the mobile app.
 */
export type ToolCapability = "read" | "write" | "defi_read" | "defi_write";

export type GrantLifetime =
  | { type: "always_ask" }
  | { type: "once" }
  | { type: "session"; session_id: string }
  | { type: "timed"; expires_at: number } // Unix ms
  | { type: "permanent" };

export type GrantScope =
  | { kind: "tool"; key: string }
  | { kind: "capability"; key: ToolCapability }
  | { kind: "global" }
  // ERC-7710 onchain delegation grant (spec Phase 2 §6.2). `key` is the
  // lowercased token address the allowance is scoped to so re-granting
  // the same asset upserts. Deliberately NOT queried by `resolveGrant`
  // (it only checks tool > capability > global), so a delegation grant
  // never widens the agent's auto-approval — it only records the signed
  // onchain authorization for display + revocation.
  | { kind: "delegation"; key: string };

/**
 * Human-readable summary of a stored ERC-7710 delegation, kept alongside
 * the (opaque, hex-encoded) `delegation` struct so the settings screen
 * can render "spend up to $X USDC, expires …" without decoding caveats.
 * All numeric fields are JSON-safe (amounts are decimal strings) so the
 * grant blob survives `JSON.stringify` in SecureStore.
 */
export interface DelegationMeta {
  delegate: `0x${string}`;
  chainId: number;
  /**
   * Human-readable chain label captured at signing time (e.g. "Base").
   * Lets the settings screen group allowances by chain without a
   * registry lookup. Optional so blobs written before this field
   * existed still deserialize — the UI falls back to `Chain <id>`.
   */
  chainName?: string;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Raw token-unit cap, as a decimal string (bigint is not JSON-safe). */
  maxAmount: string;
  /** Optional call cap mirrored from a `limitedCalls` caveat. */
  callLimit?: number;
}

export interface PermissionGrant {
  scope: GrantScope;
  lifetime: GrantLifetime;
  wallet_address: `0x${string}`;
  granted_at: number; // Unix ms
  /**
   * Signed ERC-7710 delegation (spec Phase 2 §6.2). Present only on
   * `scope.kind === "delegation"` grants. Optional + additive so every
   * existing grant blob deserializes unchanged.
   */
  delegation?: DelegationStruct;
  /** Display summary for the delegation above. */
  delegationMeta?: DelegationMeta;
}

// --- Storage adapter --------------------------------------------------------

/**
 * Minimal async key/value interface so the store can be unit-tested with an
 * in-memory mock without dragging in `expo-secure-store` at test time.
 */
export interface GrantStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

/**
 * Lazily-loaded default adapter backed by `expo-secure-store`. The module
 * is `require`d on first use so Node-based unit tests (which inject their
 * own in-memory adapter) never touch the native module loader.
 */
let secureStoreAdapterSingleton: GrantStorageAdapter | null = null;
function getSecureStoreAdapter(): GrantStorageAdapter {
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

// --- Constants --------------------------------------------------------------

const STORAGE_KEY_PREFIX = "permission_grants_";

function storageKeyFor(wallet: `0x${string}`): string {
  // Normalize to lowercase so 0xABC and 0xabc share the same slot.
  return `${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`;
}

// --- Scope helpers ----------------------------------------------------------

function scopesEqual(a: GrantScope, b: GrantScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "global") return true;
  // `a.kind === b.kind` narrows to "tool" or "capability", both of which have
  // a `key` field.
  return (a as { key: string }).key === (b as { key: string }).key;
}

function walletsEqual(a: `0x${string}`, b: `0x${string}`): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function isExpired(grant: PermissionGrant, now: number): boolean {
  return grant.lifetime.type === "timed" && grant.lifetime.expires_at <= now;
}

/**
 * Detects grants left behind by the removed `capability: "simulate"`
 * auto-approve toggle. That capability no longer exists, so such a grant can
 * never match a tool call — it's dead weight in storage and would render as a
 * stray "blockchain_simulate" row in the settings list. We drop these on load.
 *
 * The `key` is read through a `{ key: string }` cast because `ToolCapability`
 * no longer contains `"simulate"`, so a direct comparison wouldn't type-check.
 */
function isRemovedSimulateGrant(grant: PermissionGrant): boolean {
  return (
    grant.scope.kind === "capability" &&
    (grant.scope as { key: string }).key === "simulate"
  );
}

// --- Store ------------------------------------------------------------------

export class PermissionGrantStore {
  private readonly wallet: `0x${string}`;
  private readonly adapter: GrantStorageAdapter;
  private grants: PermissionGrant[] = [];
  private loadPromise: Promise<void>;
  private persistTail: Promise<void> = Promise.resolve();

  constructor(
    wallet: `0x${string}`,
    adapter?: GrantStorageAdapter,
    seed?: PermissionGrant[],
  ) {
    this.wallet = wallet;
    this.adapter = adapter ?? getSecureStoreAdapter();
    this.loadPromise = this.loadGrantsFromStorage(seed);
  }

  /**
   * Load this wallet's grants from persistent storage into memory.
   *
   * Runs once at construction. Beyond filtering to the active wallet, it
   * migrates away grants left by the removed `capability: "simulate"` toggle
   * (see `isRemovedSimulateGrant`) and, if any were dropped, re-persists the
   * cleaned set so the stale entries disappear from storage for good. Falls
   * back to the provided `seed` when storage holds nothing usable.
   */
  private async loadGrantsFromStorage(seed?: PermissionGrant[]): Promise<void> {
    let droppedStaleGrants = false;
    try {
      const raw = await this.adapter.getItem(storageKeyFor(this.wallet));
      if (raw) {
        const parsed = JSON.parse(raw) as PermissionGrant[];
        if (Array.isArray(parsed)) {
          const forThisWallet = parsed.filter(
            (g): g is PermissionGrant =>
              !!g &&
              typeof g === "object" &&
              walletsEqual(g.wallet_address, this.wallet),
          );
          this.grants = forThisWallet.filter((g) => !isRemovedSimulateGrant(g));
          droppedStaleGrants = this.grants.length !== forThisWallet.length;
        }
      }
    } catch (error) {
      console.error(
        "PermissionGrantStore: failed to load grants from storage",
        error,
      );
      this.grants = [];
    }

    if (seed && this.grants.length === 0) {
      this.grants = seed.filter((g) =>
        walletsEqual(g.wallet_address, this.wallet),
      );
      this.schedulePersist();
    } else if (droppedStaleGrants) {
      // Rewrite the on-disk blob without the dead simulate grants.
      this.schedulePersist();
    }
  }

  private schedulePersist(): void {
    const snapshot = JSON.stringify(this.grants);
    this.persistTail = this.persistTail.then(async () => {
      try {
        await this.adapter.setItem(storageKeyFor(this.wallet), snapshot);
      } catch (error) {
        console.error("PermissionGrantStore: failed to persist", error);
      }
    });
  }

  /** Resolves when the initial load from storage has completed. */
  whenLoaded(): Promise<void> {
    return this.loadPromise;
  }

  /** Resolves when all pending persistence writes have flushed. */
  flushed(): Promise<void> {
    return this.persistTail;
  }

  /** Synchronously add a grant and fire-and-forget persist it. */
  add(grant: PermissionGrant): void {
    if (!walletsEqual(grant.wallet_address, this.wallet)) {
      // Reject cross-wallet writes — the store is wallet-scoped.
      return;
    }
    // Upsert: a new grant for the same scope replaces the old one so users
    // don't accumulate stale permanent/timed grants for the same key.
    this.grants = this.grants.filter((g) => !scopesEqual(g.scope, grant.scope));
    this.grants.push(grant);
    this.schedulePersist();
  }

  /** Remove a grant by reference or scope match. */
  remove(grant: PermissionGrant): void {
    const before = this.grants.length;
    this.grants = this.grants.filter(
      (g) =>
        !(
          scopesEqual(g.scope, grant.scope) &&
          walletsEqual(g.wallet_address, grant.wallet_address)
        ),
    );
    if (this.grants.length !== before) {
      this.schedulePersist();
    }
  }

  /**
   * Find the grant matching the given scope for this wallet. Lazily prunes
   * expired timed grants so callers never see stale entries.
   */
  find(query: {
    scope: GrantScope;
    wallet: `0x${string}`;
  }): PermissionGrant | undefined {
    if (!walletsEqual(query.wallet, this.wallet)) return undefined;

    const now = Date.now();
    let mutated = false;
    const kept: PermissionGrant[] = [];
    let match: PermissionGrant | undefined;

    for (const grant of this.grants) {
      if (isExpired(grant, now)) {
        mutated = true;
        continue;
      }
      kept.push(grant);
      if (
        !match &&
        scopesEqual(grant.scope, query.scope) &&
        walletsEqual(grant.wallet_address, query.wallet)
      ) {
        match = grant;
      }
    }

    if (mutated) {
      this.grants = kept;
      this.schedulePersist();
    }

    return match;
  }

  /** List all grants for the given wallet (after lazy pruning). */
  list(wallet: `0x${string}`): PermissionGrant[] {
    if (!walletsEqual(wallet, this.wallet)) return [];
    this.prune();
    return [...this.grants];
  }

  /** Revoke every grant for the given wallet. */
  revokeAll(wallet: `0x${string}`): void {
    if (!walletsEqual(wallet, this.wallet)) return;
    if (this.grants.length === 0) return;
    this.grants = [];
    this.schedulePersist();
  }

  /** Eagerly drop expired timed grants. Call on app launch. */
  prune(): void {
    const now = Date.now();
    const before = this.grants.length;
    this.grants = this.grants.filter((g) => !isExpired(g, now));
    if (this.grants.length !== before) {
      this.schedulePersist();
    }
  }

  // --- Factories ------------------------------------------------------------

  /**
   * Conservative default: empty grant store. The wallet's ApprovalPolicy
   * will drive the UX treatment for every action.
   */
  static conservative(
    walletAddress: `0x${string}`,
    adapter?: GrantStorageAdapter,
  ): PermissionGrantStore {
    return new PermissionGrantStore(walletAddress, adapter);
  }

  /**
   * Autonomous default: seeded with a global permanent grant so the agent
   * can execute any write silently until the user revokes it.
   */
  static autonomous(
    walletAddress: `0x${string}`,
    adapter?: GrantStorageAdapter,
  ): PermissionGrantStore {
    const seed: PermissionGrant[] = [
      {
        scope: { kind: "global" },
        lifetime: { type: "permanent" },
        wallet_address: walletAddress,
        granted_at: Date.now(),
      },
    ];
    return new PermissionGrantStore(walletAddress, adapter, seed);
  }
}

// --- resolveGrant -----------------------------------------------------------

/**
 * Resolve the effective grant lifetime for a tool invocation.
 *
 * Priority (first match wins): tool-specific > capability-level > global.
 *
 * `always_ask` is a hard override: if encountered at any level (even a
 * tool-level `always_ask` on top of a global permanent grant), the resolver
 * short-circuits and returns `always_ask`. This lets users lock down a
 * single tool even in autonomous mode.
 *
 * Returns `{ type: "once" }` when no active grant matches — callers should
 * fall back to the wallet's `ApprovalPolicy`.
 */
export function resolveGrant(
  toolName: string,
  capability: ToolCapability,
  wallet: `0x${string}`,
  sessionId: string,
  store: PermissionGrantStore,
): GrantLifetime {
  const now = Date.now();
  const candidates = [
    store.find({ scope: { kind: "tool", key: toolName }, wallet }),
    store.find({ scope: { kind: "capability", key: capability }, wallet }),
    store.find({ scope: { kind: "global" }, wallet }),
  ];

  for (const grant of candidates) {
    if (!grant) continue;
    switch (grant.lifetime.type) {
      case "always_ask":
        return { type: "always_ask" };
      case "permanent":
        return grant.lifetime;
      case "session":
        if (grant.lifetime.session_id === sessionId) return grant.lifetime;
        break;
      case "timed":
        if (grant.lifetime.expires_at > now) return grant.lifetime;
        store.remove(grant);
        break;
      case "once":
        // "once" is only the fall-through default — a stored `once` grant
        // behaves the same as no grant.
        break;
    }
  }

  return { type: "once" };
}

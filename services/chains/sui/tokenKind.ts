/**
 * `detectSuiTokenKind` — Sui's "SPL vs Token-2022" analogue.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §4.1.
 *
 * Sui's fungible-token surface is not a single primitive. There are
 * three kinds, and any token-transfer feature that ignores the
 * distinction will silently fail for some users (the same bug class
 * that bit early Solana wallets which only handled the legacy SPL Token
 * program). This detector returns a discriminated union so the
 * dispatcher in `coinTransferService.ts` can pick the right PTB shape:
 *
 *   - `Coin<T>` (standard)         → tx.splitCoins + tx.transferObjects.
 *   - Regulated `Coin<T>` (DenyList) → same shape, but the chain may
 *                                       reject at submission. We surface
 *                                       deny-list aborts as a typed error.
 *   - Closed Loop `Token<T>`       → 0x2::token::transfer<T>(token, recipient, policy).
 *
 * Authority rule (non-negotiable):
 *   The detector uses ONLY chain reads. The mobile token row may carry
 *   `metadata.suiTokenKind` as a UX pre-fetch, but this module ignores
 *   it. The transfer code must re-detect at the moment of transfer so
 *   a mis-seeded API row can never cause a malformed PTB. The cache
 *   below is a session optimization (per network + coinType), not
 *   authority.
 *
 * SDK note (2.16):
 *   The class formerly known as `SuiClient` is now `SuiJsonRpcClient`,
 *   imported from `@mysten/sui/jsonRpc`. We re-export a `SuiClient`
 *   type alias so call-sites can keep using the conventional name.
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

import { breadcrumb } from "../../telemetry/sui";

/**
 * Type alias preserving the conventional name. `SuiClient` was renamed
 * to `SuiJsonRpcClient` in @mysten/sui 2.x (the `client` subpath now
 * exports the lower-level `BaseClient` / `CoreClient` primitives). Call
 * sites that want to type a JSON-RPC client should import this alias
 * from here so a future SDK rename is contained to one file.
 */
export type SuiClient = SuiJsonRpcClient;

/**
 * Discriminated union over the three Sui fungible-token kinds we
 * support transferring in v1. NFTs / kiosk objects → detector returns
 * `null` and the caller throws `SuiUnsupportedTokenKindError`.
 */
export type SuiTokenKind =
  | { kind: "coin"; regulated: false; decimals: number }
  | { kind: "coin"; regulated: true; decimals: number; denyListId: string }
  | { kind: "closed-loop"; decimals: number; tokenPolicyId: string };

/**
 * Session-scoped cache keyed by `${network}:${coinType}`. Cleared via
 * {@link clearSuiTokenKindCache}. Wallet-service teardown should call
 * the clear helper alongside the keypair-cache wipe — TODO wiring is
 * documented at the call-site (see comment on `clearSuiTokenKindCache`).
 *
 * The cache key embeds the network string the caller passes in (or
 * `"unknown"` if omitted) so a token observed on testnet doesn't bleed
 * into mainnet detection.
 */
const cache = new Map<string, SuiTokenKind>();

function cacheKey(network: string, coinType: string): string {
  return `${network}:${coinType}`;
}

/**
 * Clear the session-scoped detector cache. Intended to be called from
 * `walletService.clearAccountCache()` so a logout / wallet-switch
 * doesn't leave per-network state behind.
 *
 * TODO(task-07-followup): wire into walletService — out of scope here
 * to keep this PR pure (no walletService modifications).
 */
export function clearSuiTokenKindCache(): void {
  cache.clear();
}

/**
 * Try to read a deny-list shared-object id for a regulated `Coin<T>`.
 *
 * This is intentionally a heuristic for v1. The exact DenyList layout
 * (`0x403::deny_list::DenyList` + `coin::DenyCapV2`) requires walking
 * the shared object's dynamic-field map keyed on the coin's type tag.
 * Doing that perfectly without on-chain testing risks false positives
 * (claiming a non-regulated coin is regulated and emitting the wrong
 * UX copy) which is worse than under-detecting.
 *
 * Strategy:
 *   - Best-effort `getDynamicFieldObject` against the well-known
 *     deny-list shared object, treating any non-error response with a
 *     populated `data.objectId` as "regulated" + capturing the id.
 *   - On any error (RPC failure, unknown layout) return `null` and let
 *     the caller treat the coin as non-regulated. The chain remains the
 *     authoritative gate at submission time — a regulated coin we
 *     missed here will still abort with `EAddressDeniedForCoin` /
 *     `ESenderDeniedForCoin`, which the dispatcher catches and rethrows
 *     as `SuiRegulatedCoinDeniedError`. So a miss here only loses the
 *     pre-flight UX hint, not safety.
 *
 * TODO(task-07-followup): tighten regulated detection. The right shape
 * is to query the deny-list shared object for the type tag's entry and
 * verify both the existence and the field type, but that needs
 * on-chain fixtures we don't have in CI yet.
 */
async function resolveDenyListForCoin(
  client: SuiClient,
  coinType: string,
): Promise<string | null> {
  // The well-known deny-list shared object. The exact id is
  // network-specific in pathological cases but stable on mainnet /
  // testnet. We pass it as a hex string; the SDK accepts that form.
  const DENY_LIST_PARENT = "0x403";

  try {
    const res = await client.getDynamicFieldObject({
      parentId: DENY_LIST_PARENT,
      name: {
        type: "0x1::type_name::TypeName",
        value: { name: coinType },
      },
    });
    const id = res?.data?.objectId;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a `TokenPolicy<T>` for a coin type that is NOT a `Coin<T>`.
 *
 * In v1 we treat this as a fragile lookup: querying for
 * `0x2::token::TokenPolicyCreated<T>` events is the documented Mysten
 * pattern, but the shape varies and an unresolved policy is a UX
 * dead-end — the closed-loop transfer can't proceed without it.
 *
 * Strategy: best-effort `queryEvents` for the typed event; on the
 * first hit, return `{ id, decimals }`. On any failure, return `null`
 * — the dispatcher converts that into
 * `SuiUnsupportedTokenKindError(coinType)` upstream, which renders as
 * "this token type isn't supported for transfers yet" in the UI. The
 * dApp-bridge milestone (Task 11) will exercise the closed-loop path
 * via PTBs constructed by dApps, where the policy id is supplied.
 *
 * TODO(task-07-followup): add a registry override seam so power users
 * (and integrators) can paste a `TokenPolicy<T>` id explicitly when
 * the heuristic misses.
 */
async function resolveTokenPolicy(
  client: SuiClient,
  coinType: string,
): Promise<{ id: string; decimals: number } | null> {
  try {
    const events = await client.queryEvents({
      query: {
        MoveEventType: `0x2::token::TokenPolicyCreated<${coinType}>`,
      },
      limit: 1,
    });
    const evt = events?.data?.[0];
    if (!evt) return null;
    // The created-event payload typically carries the policy object id
    // and a decimals hint. Fields vary by Move source; if either is
    // missing we treat it as unresolved.
    const parsed = (evt.parsedJson ?? {}) as Record<string, unknown>;
    const id =
      (typeof parsed.policy_id === "string" && parsed.policy_id) ||
      (typeof parsed.id === "string" && parsed.id) ||
      null;
    const decimalsRaw = parsed.decimals;
    const decimals =
      typeof decimalsRaw === "number"
        ? decimalsRaw
        : typeof decimalsRaw === "string"
          ? Number.parseInt(decimalsRaw, 10)
          : Number.NaN;
    if (!id || !Number.isFinite(decimals)) return null;
    return { id, decimals };
  } catch {
    return null;
  }
}

/**
 * Optional argument bag for {@link detectSuiTokenKind}. The detector
 * does not read the network for any RPC call (the client carries that)
 * — it's only used to scope the session cache so the same coinType
 * observed on different networks stays separate.
 */
export interface DetectSuiTokenKindOptions {
  /** Cache key scope (e.g. `"mainnet" | "testnet"`). Defaults to `"unknown"`. */
  network?: string;
}

/**
 * Detect which Sui fungible-token kind a `coinType` belongs to.
 *
 * Returns:
 *   - `{ kind: "coin", regulated: false, decimals }`            — standard Coin<T>.
 *   - `{ kind: "coin", regulated: true, decimals, denyListId }` — regulated Coin<T>.
 *   - `{ kind: "closed-loop", decimals, tokenPolicyId }`        — Closed Loop Token<T>.
 *   - `null`                                                    — NFT, kiosk-only,
 *                                                                  or unindexed Closed Loop.
 *
 * Algorithm (spec §4.1):
 *   1. `client.getCoinMetadata({ coinType })`. If non-null → it's a Coin<T>.
 *   2. For Coin<T>, attempt deny-list resolution; success → regulated.
 *   3. Otherwise resolve `TokenPolicy<T>`; success → closed-loop.
 *   4. Else null.
 *
 * The result is cached per (network, coinType) for the session — but
 * the dispatcher must still re-detect at every transfer (no API
 * trust). The cache only avoids redundant RPC roundtrips between the
 * send-sheet render and the transfer execution.
 */
export async function detectSuiTokenKind(
  client: SuiClient,
  coinType: string,
  options?: DetectSuiTokenKindOptions,
): Promise<SuiTokenKind | null> {
  const network = options?.network ?? "unknown";
  const key = cacheKey(network, coinType);
  const cached = cache.get(key);
  if (cached) return cached;

  // Cache miss → drop a breadcrumb so a misbehaving caller that
  // re-detects on every render shows up in telemetry. We intentionally
  // do NOT log `coinType` (treated as PII for v1).
  breadcrumb({
    category: "sui.detectTokenKind",
    message: "cache-miss",
    level: "info",
    data: { network },
  });

  try {
    // 1. Coin<T> path.
    const meta = await client.getCoinMetadata({ coinType });
    if (meta) {
      const decimals = meta.decimals;
      // 2. Regulated detection (best-effort heuristic — see
      //    resolveDenyListForCoin notes).
      const denyListId = await resolveDenyListForCoin(client, coinType);
      const result: SuiTokenKind = denyListId
        ? { kind: "coin", regulated: true, decimals, denyListId }
        : { kind: "coin", regulated: false, decimals };
      cache.set(key, result);
      return result;
    }

    // 3. Closed Loop path.
    const policy = await resolveTokenPolicy(client, coinType);
    if (policy) {
      const result: SuiTokenKind = {
        kind: "closed-loop",
        decimals: policy.decimals,
        tokenPolicyId: policy.id,
      };
      cache.set(key, result);
      return result;
    }

    // 4. Unknown / unsupported (NFTs, kiosk-only, unindexed Closed Loop).
    return null;
  } catch (err) {
    breadcrumb({
      category: "sui.detectTokenKind",
      message: "error",
      level: "error",
      data: {
        network,
        errorName: err instanceof Error ? err.name : typeof err,
      },
    });
    throw err;
  }
}

/**
 * Read a Closed Loop `Token<T>` balance for an owner.
 *
 * Exported for the wallet kit's `getTokenBalance` branch — when the
 * detector returns `kind: "closed-loop"`, the kit must NOT call
 * `client.getBalance` (which only knows about `Coin<T>`). It instead
 * sums the owner's `Token<T>` objects.
 *
 * v1 implementation: `client.getBalance` will return zero for closed-
 * loop tokens; the correct path uses `getOwnedObjects` with a type
 * filter on `0x2::token::Token<T>`. We approximate that by paginating
 * `getOwnedObjects` and summing each `Token<T>` object's `balance`
 * field if the SDK surfaces it. If the SDK doesn't surface the field
 * cheaply (or we fail to resolve the layout) we return `0n` — a safe
 * lower bound that displays as "no balance" rather than a crash.
 *
 * TODO(task-07-followup): once on-chain test fixtures exist, tighten
 * this to read `Token<T>::balance` directly via BCS rather than the
 * parsed-JSON path.
 */
export async function getClosedLoopTokenBalance(
  client: SuiClient,
  args: { owner: string; coinType: string; tokenPolicyId?: string },
): Promise<bigint> {
  const tokenType = `0x2::token::Token<${args.coinType}>`;
  let total = 0n;
  let cursor: string | null | undefined = undefined;
  // Bounded loop — closed-loop wallets typically hold only a handful
  // of token objects; cap the pagination to protect against pathological
  // cases (mis-typed query, infinite loop).
  for (let page = 0; page < 20; page++) {
    const res = await client.getOwnedObjects({
      owner: args.owner,
      filter: { StructType: tokenType },
      options: { showContent: true },
      cursor: cursor ?? undefined,
    });
    for (const item of res?.data ?? []) {
      const content = item?.data?.content;
      // `content` is a `MoveObject` discriminated union; the parsed
      // fields live at `.fields` for `MoveObject`s. Guard everything
      // — any shape mismatch silently contributes 0.
      if (
        content &&
        typeof content === "object" &&
        "dataType" in content &&
        content.dataType === "moveObject"
      ) {
        const fields = (content as { fields?: Record<string, unknown> }).fields;
        const balanceRaw = fields?.balance;
        if (typeof balanceRaw === "string") {
          try {
            total += BigInt(balanceRaw);
          } catch {
            // ignore non-numeric strings
          }
        } else if (typeof balanceRaw === "number") {
          total += BigInt(Math.trunc(balanceRaw));
        }
      }
    }
    if (!res?.hasNextPage || !res?.nextCursor) break;
    cursor = res.nextCursor;
  }
  return total;
}

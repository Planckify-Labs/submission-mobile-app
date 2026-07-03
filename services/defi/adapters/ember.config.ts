/**
 * Ember Vaults config & address resolution — NO SDK.
 *
 * Ember (Sui, Bluefin-incubated) is a generic tokenized-vault protocol — the
 * closest thing to an ERC-4626 vault on Sui. A deposit is one public Move call
 * (`gateway::deposit_asset_v2<T,R>`); the only mutable deployment ids the
 * adapter needs are the protocol PACKAGE (the moveCall target) and the shared
 * `ProtocolConfig` object. Both are served over plain HTTPS by the Bluefin
 * Ember Vaults API, so — exactly like `scallop.config.ts` — we:
 *
 *   - take the per-vault identity (vault object id + coinType + shareType) from
 *     the server-resolved `DepositTarget` (immutable, pinned at resolve time),
 *     and
 *   - FETCH the core ids (package + ProtocolConfig) from the API, MMKV-cached
 *     with a TTL + a pinned fallback — because the PACKAGE id changes on a
 *     package upgrade ("config not constants", spec §3.1). The pinned fallback
 *     below was already stale in the repo's `Move.toml` vs. the live API, which
 *     is exactly why this must be fetched, not hardcoded forever.
 *
 * Mainnet-only (the adapter's `chainId:"mainnet"` gates it). MMKV is imported
 * dynamically so this module's static graph stays free of native modules
 * (mirrors `scallop.config.ts`).
 */

/** Bluefin Ember Vaults API — `VaultProtocol.{Package,ProtocolConfig}`. */
const INFO_API = "https://vaults.api.sui-prod.bluefin.io/api/v1/vaults/info";
const CACHE_KEY = "ember_core_addrs_v1";
const TS_KEY = "ember_core_addrs_ts_v1";
const STALE_MS = 30 * 60 * 1000;

export interface EmberCore {
  /** Current protocol package id — the `gateway::*` moveCall target. */
  packageId: string;
  /** `&ProtocolConfig` shared object. */
  protocolConfig: string;
}

/** Pinned fallback for the mutable core ids (verified from the live API 2026-07-03). */
const FALLBACK_CORE: EmberCore = {
  packageId:
    "0x4269cb19a1a7938c8263d21c08d98b9324e5985522072ae3d76928650aed809f",
  protocolConfig:
    "0x3a515233ab817af082ef31454cee5eb8122b8b7cd586bf6b26ae9b879ee1e565",
};

interface EmberInfoPayload {
  VaultProtocol?: {
    Package?: string;
    ProtocolConfig?: string;
  };
}

function safeParseCore(s: string): EmberCore | null {
  try {
    const o = JSON.parse(s) as Partial<EmberCore>;
    if (o.packageId && o.protocolConfig) return o as EmberCore;
  } catch {
    // fall through
  }
  return null;
}

let inflight: Promise<EmberCore> | undefined;

/**
 * Resolve Ember's mainnet core ids — protocol package (moveCall target) +
 * ProtocolConfig shared object. MMKV-cached (TTL); refreshed from the Ember
 * Vaults API so a package upgrade is picked up without an app release; falls
 * back to the last-good cache, then to pinned constants, so a deposit never
 * breaks on a config read. Mirrors `getScallopCore`.
 */
export async function getEmberCore(): Promise<EmberCore> {
  const { storage } = await import("@/lib/storage/mmkv");
  const cached = storage.getString(CACHE_KEY);
  const ts = Number.parseInt(storage.getString(TS_KEY) ?? "0", 10) || 0;
  if (cached && Date.now() - ts < STALE_MS) {
    const parsed = safeParseCore(cached);
    if (parsed) return parsed;
  }
  if (inflight) return inflight;

  const task = (async (): Promise<EmberCore> => {
    try {
      const res = await fetch(INFO_API);
      const json = (await res.json()) as EmberInfoPayload;
      const proto = json?.VaultProtocol;
      const resolved: EmberCore = {
        packageId: proto?.Package ?? FALLBACK_CORE.packageId,
        protocolConfig: proto?.ProtocolConfig ?? FALLBACK_CORE.protocolConfig,
      };
      storage.set(CACHE_KEY, JSON.stringify(resolved));
      storage.set(TS_KEY, Date.now().toString());
      return resolved;
    } catch {
      return (cached ? safeParseCore(cached) : null) ?? FALLBACK_CORE;
    } finally {
      inflight = undefined;
    }
  })();
  inflight = task;
  return task;
}

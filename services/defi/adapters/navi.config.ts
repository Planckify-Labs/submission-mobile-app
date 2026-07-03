/**
 * NAVI config & address resolution — NO SDK.
 *
 * NAVI's supply/withdraw are public Move calls on `lending_core::incentive_v3`.
 * The per-asset identity (assetId + `Pool<T>` object + coinType) rides on the
 * resolved `DepositTarget`; the CORE shared objects live here.
 *
 * Split by mutability ("config not constants", spec §3.1):
 *   - The PACKAGE id is MUTABLE — NAVI version-gates its shared `Storage`, so a
 *     call built against a stale package ABORTS. NAVI upgrades it regularly
 *     (the SDK fetches "the latest protocol package" at runtime), so we FETCH it
 *     from NAVI's package API, MMKV-cached with a TTL + a pinned fallback. A
 *     stale pin here silently breaks every NAVI deposit — this is exactly the
 *     bug the fetch avoids.
 *   - Storage / PriceOracle / IncentiveV2 / IncentiveV3 are STABLE shared
 *     objects (verified against navi-sdk `address.ts`, 2026-07-03) — pinned.
 *
 * MMKV is imported dynamically so this module's static graph stays free of
 * native modules (mirrors `scallop.config.ts`).
 */

/** NAVI's authoritative "current package" endpoint (`{ packageId, outdated }`). */
const PACKAGE_API = "https://open-api.naviprotocol.io/api/package";
const CACHE_KEY = "navi_package_v1";
const TS_KEY = "navi_package_ts_v1";
const STALE_MS = 30 * 60 * 1000;

/** Stable shared objects (navi-sdk address.ts, verified 2026-07-03). */
const STORAGE =
  "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe";
const PRICE_ORACLE =
  "0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef";
const INCENTIVE_V2 =
  "0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c";
const INCENTIVE_V3 =
  "0x62982dad27fb10bb314b3384d5de8d2ac2d72ab2dbeae5d801dbdb9efa816c80";

/** Pinned fallback for the mutable package (current as of 2026-07-03). */
const FALLBACK_PACKAGE =
  "0x1e4a13a0494d5facdbe8473e74127b838c2d446ecec0ce262e2eddafa77259cb";

export interface NaviCore {
  /** Current `lending_core` package — the `incentive_v3::*` moveCall target. */
  packageId: string;
  /** `&mut Storage` shared object. */
  storage: string;
  /** `&PriceOracle` shared object (withdraw path). */
  priceOracle: string;
  /** `&mut IncentiveV2` shared object. */
  incentiveV2: string;
  /** `&mut Incentive` (v3) shared object. */
  incentiveV3: string;
}

interface NaviPackagePayload {
  packageId?: string;
}

let inflight: Promise<string> | undefined;

/** Resolve NAVI's current protocol package id (MMKV-cached, fetched, fallback). */
async function resolvePackageId(): Promise<string> {
  const { storage } = await import("@/lib/storage/mmkv");
  const cached = storage.getString(CACHE_KEY);
  const ts = Number.parseInt(storage.getString(TS_KEY) ?? "0", 10) || 0;
  if (cached && Date.now() - ts < STALE_MS) return cached;
  if (inflight) return inflight;

  const task = (async (): Promise<string> => {
    try {
      const res = await fetch(PACKAGE_API);
      const json = (await res.json()) as NaviPackagePayload;
      const pkg = json?.packageId;
      if (pkg && /^0x[0-9a-fA-F]+$/.test(pkg)) {
        storage.set(CACHE_KEY, pkg);
        storage.set(TS_KEY, Date.now().toString());
        return pkg;
      }
      return cached || FALLBACK_PACKAGE;
    } catch {
      return cached || FALLBACK_PACKAGE;
    } finally {
      inflight = undefined;
    }
  })();
  inflight = task;
  return task;
}

/**
 * Resolve NAVI's core ids — current package (fetched) + the pinned stable shared
 * objects. Never breaks a deposit on a config read (falls back to the last-good
 * cache, then to the pinned package). Mirrors `getScallopCore`.
 */
export async function getNaviCore(): Promise<NaviCore> {
  return {
    packageId: await resolvePackageId(),
    storage: STORAGE,
    priceOracle: PRICE_ORACLE,
    incentiveV2: INCENTIVE_V2,
    incentiveV3: INCENTIVE_V3,
  };
}

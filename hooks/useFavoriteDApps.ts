import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { dappApi } from "@/api/endpoints/dapps";
import type { TAppearance, TDapp } from "@/api/types/dapp";
import { isStellarDapp } from "@/constants/configs/stellarDapps";
import { useIsAuthenticated } from "@/hooks/queries/useAuth";
import { storage } from "@/lib/storage/mmkv";

const FAVORITE_DAPPS_KEY = "takumipay_favorite_dapps";

/**
 * Favorites are **local-first**: MMKV is the source of truth, so they
 * work with zero auth, offline, and render synchronously on first frame.
 * When the user is signed in we reconcile with the server in the
 * background (best-effort) so favorites survive a reinstall / sync across
 * devices. A failed sync never blocks or rolls back a local toggle.
 *
 * `deleted` tombstones let an unfavorite propagate to the server instead
 * of being resurrected by a stale server row on the next reconcile.
 */
export type TFavoriteRecord = {
  id: string;
  // denormalized snapshot so the Favorites row renders without refetching:
  name: string;
  description: string;
  websiteUrl: string;
  logoUrl: string;
  appearance?: TAppearance | null;
  updatedAt: number;
  deleted?: boolean;
};

// Minimum a caller must hand us to favorite something (an API TDapp fits).
type FavoritableDApp = Pick<
  TDapp,
  "id" | "name" | "description" | "websiteUrl" | "logoUrl"
> & { appearance?: TAppearance | null };

const readStore = (): TFavoriteRecord[] => {
  try {
    const raw = storage.getString(FAVORITE_DAPPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (TFavoriteRecord & {
      url?: string;
      timestamp?: number;
    })[];
    // Migrate the pre-API shape ({ url, timestamp }) forward in place.
    return parsed.map((r) => ({
      ...r,
      websiteUrl: r.websiteUrl ?? r.url ?? "",
      updatedAt: r.updatedAt ?? r.timestamp ?? Date.now(),
    }));
  } catch {
    return [];
  }
};

const writeStore = (records: TFavoriteRecord[]) => {
  storage.set(FAVORITE_DAPPS_KEY, JSON.stringify(records));
};

const activeOf = (records: TFavoriteRecord[]) =>
  records.filter((r) => !r.deleted).sort((a, b) => b.updatedAt - a.updatedAt);

/**
 * Best-effort reconcile against the server. Pulls the user's server
 * favorites, pushes local-only adds and pending tombstones, and merges
 * server-only favorites down into MMKV. Returns the merged record list,
 * or null if nothing was reconciled (so callers can skip a state update).
 */
const reconcile = async (): Promise<TFavoriteRecord[] | null> => {
  const local = readStore();
  let serverFavorites: TDapp[] = [];
  try {
    serverFavorites = await dappApi.getFavoriteDapps();
  } catch (err) {
    // Not signed in / offline / server down — stay local-only, retry later.
    if (__DEV__) console.warn("[favorites] reconcile pull failed:", err);
    return null;
  }

  const serverIds = new Set(serverFavorites.map((d) => d.id));
  const byId = new Map(local.map((r) => [r.id, r]));

  // Push local intent to the server (fire each, swallow individual errors).
  await Promise.allSettled(
    local.map(async (r) => {
      if (r.deleted && serverIds.has(r.id)) {
        await dappApi.removeFavorite(r.id);
      } else if (!r.deleted && !serverIds.has(r.id)) {
        await dappApi.addFavorite(r.id);
      }
    }),
  );

  // Pull server-only favorites down into the local store.
  for (const d of serverFavorites) {
    const existing = byId.get(d.id);
    if (existing?.deleted) continue; // local unfavorite wins until pushed
    byId.set(d.id, {
      id: d.id,
      name: d.name,
      description: d.description,
      websiteUrl: d.websiteUrl,
      logoUrl: d.logoUrl,
      appearance: d.appearance,
      updatedAt: existing?.updatedAt ?? Date.now(),
    });
  }

  // Drop tombstones we've now propagated.
  const merged = [...byId.values()].filter(
    (r) => !(r.deleted && serverIds.has(r.id)),
  );
  writeStore(merged);
  return merged;
};

export const useFavoriteDApps = () => {
  // Synchronous MMKV read — favorites are ready on first render.
  const [records, setRecords] = useState<TFavoriteRecord[]>(readStore);
  const { isAuthenticated } = useIsAuthenticated();

  // Display-only filter — a favorite recorded before the app went
  // Stellar-only stays in MMKV (so re-enabling other chains later
  // resurfaces it), it just doesn't render in the "Favorites" rail.
  const favoriteDApps = activeOf(records).filter((r) => isStellarDapp(r.id));

  const isFavorite = useCallback(
    (dappId: string): boolean =>
      records.some((r) => r.id === dappId && !r.deleted),
    [records],
  );

  const toggleFavorite = useCallback(
    (dapp: FavoritableDApp) => {
      const now = Date.now();
      const existing = records.find((r) => r.id === dapp.id);
      const willFavorite = !existing || existing.deleted;

      const next: TFavoriteRecord[] = willFavorite
        ? [
            {
              id: dapp.id,
              name: dapp.name,
              description: dapp.description,
              websiteUrl: dapp.websiteUrl,
              logoUrl: dapp.logoUrl,
              appearance: dapp.appearance,
              updatedAt: now,
            },
            ...records.filter((r) => r.id !== dapp.id),
          ]
        : isAuthenticated
          ? // signed in: keep a tombstone so the removal can sync, then prune
            records.map((r) =>
              r.id === dapp.id ? { ...r, deleted: true, updatedAt: now } : r,
            )
          : // signed out: nothing to sync to, just drop the record
            records.filter((r) => r.id !== dapp.id);

      setRecords(next);
      writeStore(next);

      // Optimistic: local already updated. Fire the server write if signed
      // in; on failure we keep the local state and let reconcile retry.
      if (isAuthenticated) {
        const op = willFavorite
          ? dappApi.addFavorite(dapp.id)
          : dappApi.removeFavorite(dapp.id);
        op.catch((err) => {
          if (__DEV__) console.warn("[favorites] server toggle failed:", err);
        });
      }

      return willFavorite;
    },
    [records, isAuthenticated],
  );

  const clearAllFavorites = useCallback(() => {
    setRecords([]);
    writeStore([]);
  }, []);

  // Background reconcile on sign-in and on every foreground.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const run = () => {
      reconcile()
        .then((merged) => {
          if (!cancelled && merged) setRecords(merged);
        })
        .catch(() => {});
    };
    run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isAuthenticated]);

  return {
    favoriteDApps,
    isLoading: false, // synchronous — never in a loading state
    isFavorite,
    toggleFavorite,
    clearAllFavorites,
  };
};

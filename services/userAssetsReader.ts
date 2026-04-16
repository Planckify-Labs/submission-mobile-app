/**
 * Direct reader for the asset-explorer's "my assets" AsyncStorage blobs,
 * without depending on `useUserAssets`'s global `activeNetwork` state.
 *
 * Rationale: `useUserAssets` reads the list keyed off whatever chain the
 * asset-explorer screen last set. The transfer-thresholds screen has
 * its own notion of "active chain" (from `useWallet().activeChain`),
 * and coupling it to the explorer's state would create invisible
 * ordering bugs (open thresholds before asset-explorer → empty list,
 * switch chains on asset-explorer → thresholds screen silently changes).
 *
 * Storage key format mirrors `useUserAssets.getStorageKey()`:
 *   wallet_assets_${address}_${chainIdString}
 *
 * Keep in sync with that hook. If the key schema ever changes, update
 * both together — the invariant is that this reader observes the same
 * bytes the hook writes.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TCryptoAsset } from "@/constants/types/assetTypes";

function storageKeyFor(address: string, chainId: number): string {
  return `wallet_assets_${address}_${chainId}`;
}

export async function readUserAssetsForChain(
  address: string,
  chainId: number,
): Promise<TCryptoAsset[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKeyFor(address, chainId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TCryptoAsset[]) : [];
  } catch (err) {
    console.warn("readUserAssetsForChain: failed to read", err);
    return [];
  }
}

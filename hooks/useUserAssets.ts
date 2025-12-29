import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect } from "react";
import type { TCryptoAsset } from "@/constants/types/assetTypes";
import {
  addAsset,
  addCustomToken,
  addMultipleAssets,
  filterAssets,
  removeAsset,
} from "@/utils/assetUtils";
import { useActiveNetwork } from "./useAssetExplorerState";
import useRQGlobalState from "./useRQGlobalState";
import { useWallet } from "./useWallet";

const QUERY_KEY = ["userAssets"] as const;

export const useUserAssets = () => {
  const { wallets, activeWalletIndex } = useWallet();
  const activeWallet = wallets[activeWalletIndex];
  const { activeNetwork } = useActiveNetwork();

  const { data: userAssets, setNewData: setUserAssets } = useRQGlobalState<
    TCryptoAsset[]
  >({
    queryKey: QUERY_KEY,
    initialData: [],
  });

  const getStorageKey = useCallback(() => {
    return `wallet_assets_${activeWallet?.address}_${activeNetwork}`;
  }, [activeWallet?.address, activeNetwork]);

  const loadUserAssets = useCallback(async () => {
    try {
      const storageKey = getStorageKey();
      const storedAssets = await AsyncStorage.getItem(storageKey);

      if (storedAssets) {
        setUserAssets(JSON.parse(storedAssets));
      } else {
        setUserAssets([]);
      }
    } catch (error) {
      console.error("Failed to load assets:", error);
    }
  }, [getStorageKey, setUserAssets]);

  const saveUserAssets = useCallback(async () => {
    try {
      const storageKey = getStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(userAssets));
    } catch (error) {
      console.error("Failed to save assets:", error);
    }
  }, [userAssets, getStorageKey]);

  useEffect(() => {
    if (activeWallet?.address && activeNetwork) {
      loadUserAssets();
    }
  }, [activeWallet?.address, activeNetwork, loadUserAssets]);

  useEffect(() => {
    if (activeWallet?.address && userAssets && userAssets.length > 0) {
      saveUserAssets();
    }
  }, [activeWallet?.address, userAssets, saveUserAssets]);

  const handleAddAsset = useCallback(
    (asset: TCryptoAsset) => {
      setUserAssets(addAsset(userAssets ?? [], asset));
    },
    [userAssets, setUserAssets],
  );

  const handleRemoveAsset = useCallback(
    (assetId: string) => {
      setUserAssets(removeAsset(userAssets ?? [], assetId));
    },
    [userAssets, setUserAssets],
  );

  const handleAddCustomToken = useCallback(
    async (tokenAddress: string) => {
      const updatedAssets = await addCustomToken(
        userAssets ?? [],
        tokenAddress,
      );
      setUserAssets(updatedAssets);
    },
    [userAssets, setUserAssets],
  );

  const handleAddMultipleAssets = useCallback(
    (assetsToAdd: TCryptoAsset[]) => {
      setUserAssets(addMultipleAssets(userAssets ?? [], assetsToAdd));
    },
    [userAssets, setUserAssets],
  );

  const isAssetAdded = useCallback(
    (assetId: string) => {
      return (userAssets ?? []).some((asset) => asset.id === assetId);
    },
    [userAssets],
  );

  const getFilteredAssets = useCallback(
    (searchQuery: string) => {
      return filterAssets(userAssets ?? [], searchQuery);
    },
    [userAssets],
  );

  return {
    userAssets: userAssets ?? [],
    addAsset: handleAddAsset,
    removeAsset: handleRemoveAsset,
    addCustomToken: handleAddCustomToken,
    addMultipleAssets: handleAddMultipleAssets,
    isAssetAdded,
    getFilteredAssets,
  };
};

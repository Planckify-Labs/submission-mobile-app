import { useCallback } from "react";
import type { TCryptoAsset } from "@/constants/types/assetTypes";
import {
  enterSelectionMode,
  exitSelectionMode,
  isAssetSelected,
  toggleAssetSelection,
} from "@/utils/selectionUtils";
import useRQGlobalState from "./useRQGlobalState";

const QUERY_KEYS = {
  selectionMode: ["assetSelection", "mode"] as const,
  selectedAssets: ["assetSelection", "assets"] as const,
  currentAsset: ["assetSelection", "currentAsset"] as const,
  walletSelectorVisible: ["assetSelection", "walletSelectorVisible"] as const,
};

export const useAssetSelection = () => {
  const { data: selectionMode, setNewData: setSelectionMode } =
    useRQGlobalState<boolean>({
      queryKey: QUERY_KEYS.selectionMode,
      initialData: false,
    });

  const { data: selectedAssets, setNewData: setSelectedAssets } =
    useRQGlobalState<TCryptoAsset[]>({
      queryKey: QUERY_KEYS.selectedAssets,
      initialData: [],
    });

  const { data: currentAsset, setNewData: setCurrentAsset } =
    useRQGlobalState<TCryptoAsset | null>({
      queryKey: QUERY_KEYS.currentAsset,
      initialData: null,
    });

  const { data: walletSelectorVisible, setNewData: setWalletSelectorVisible } =
    useRQGlobalState<boolean>({
      queryKey: QUERY_KEYS.walletSelectorVisible,
      initialData: false,
    });

  const handleAssetLongPress = useCallback(
    (asset: TCryptoAsset) => {
      if (!selectionMode) {
        setSelectionMode(true);
        setSelectedAssets(enterSelectionMode(asset));
      }
    },
    [selectionMode, setSelectionMode, setSelectedAssets],
  );

  const handleToggleAssetSelection = useCallback(
    (asset: TCryptoAsset) => {
      setSelectedAssets(toggleAssetSelection(selectedAssets ?? [], asset));
    },
    [selectedAssets, setSelectedAssets],
  );

  const cancelSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedAssets(exitSelectionMode());
  }, [setSelectionMode, setSelectedAssets]);

  const openWalletSelector = useCallback(
    (asset?: TCryptoAsset) => {
      if (asset) {
        setCurrentAsset(asset);
      }
      setWalletSelectorVisible(true);
    },
    [setCurrentAsset, setWalletSelectorVisible],
  );

  const closeWalletSelector = useCallback(() => {
    setWalletSelectorVisible(false);
    setCurrentAsset(null);
  }, [setWalletSelectorVisible, setCurrentAsset]);

  const confirmSelection = useCallback(() => {
    setWalletSelectorVisible(false);
    setSelectionMode(false);
    setSelectedAssets([]);
    setCurrentAsset(null);
  }, [
    setWalletSelectorVisible,
    setSelectionMode,
    setSelectedAssets,
    setCurrentAsset,
  ]);

  const checkIsAssetSelected = useCallback(
    (assetId: string) => {
      return isAssetSelected(selectedAssets ?? [], assetId);
    },
    [selectedAssets],
  );

  return {
    selectionMode: selectionMode ?? false,
    selectedAssets: selectedAssets ?? [],
    currentAsset: currentAsset ?? null,
    walletSelectorVisible: walletSelectorVisible ?? false,
    handleAssetLongPress,
    handleToggleAssetSelection,
    cancelSelectionMode,
    openWalletSelector,
    closeWalletSelector,
    confirmSelection,
    isAssetSelected: checkIsAssetSelected,
  };
};

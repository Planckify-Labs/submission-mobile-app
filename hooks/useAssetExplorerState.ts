import { useCallback } from "react";
import type { TAssetTabType } from "@/constants/types/assetTypes";
import useRQGlobalState from "./useRQGlobalState";

const QUERY_KEYS = {
  activeTab: ["assetExplorer", "activeTab"] as const,
  activeNetwork: ["assetExplorer", "activeNetwork"] as const,
  activeBlockchainId: ["assetExplorer", "activeBlockchainId"] as const,
  searchQuery: ["assetExplorer", "searchQuery"] as const,
};

export const useActiveTab = () => {
  const { data, setNewData } = useRQGlobalState<TAssetTabType>({
    queryKey: QUERY_KEYS.activeTab,
    initialData: "my-assets",
  });

  return {
    activeTab: data ?? "my-assets",
    setActiveTab: setNewData,
  };
};

export const useActiveNetwork = () => {
  const { data: activeNetwork, setNewData: setActiveNetwork } =
    useRQGlobalState<string>({
      queryKey: QUERY_KEYS.activeNetwork,
      initialData: "",
    });

  const { data: activeBlockchainId, setNewData: setActiveBlockchainId } =
    useRQGlobalState<string | null>({
      queryKey: QUERY_KEYS.activeBlockchainId,
      initialData: null,
    });

  const selectNetwork = useCallback(
    (networkId: string, blockchainId?: string) => {
      setActiveNetwork(networkId);
      setActiveBlockchainId(blockchainId ?? null);
    },
    [setActiveNetwork, setActiveBlockchainId],
  );

  return {
    activeNetwork: activeNetwork ?? "",
    activeBlockchainId: activeBlockchainId ?? undefined,
    selectNetwork,
  };
};

export const useAssetSearchQuery = () => {
  const { data, setNewData } = useRQGlobalState<string>({
    queryKey: QUERY_KEYS.searchQuery,
    initialData: "",
  });

  return {
    searchQuery: data ?? "",
    setSearchQuery: setNewData,
  };
};

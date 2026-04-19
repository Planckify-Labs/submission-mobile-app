import { useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AddTokenForm from "@/components/asset-explorer/AddTokenForm";
import AssetExplorerHeader from "@/components/asset-explorer/AssetExplorerHeader";
import AssetWalletSelectorModal from "@/components/asset-explorer/AssetWalletSelectorModal";
import AvailableAssetList from "@/components/asset-explorer/AvailableAssetList";
import AssetExplorerTabs from "@/components/asset-explorer/MyAssetsAndExploreAssetTabs";
import NetworkRadioButtons from "@/components/asset-explorer/NetworkRadioButtons";
import NetworkSelectorModal from "@/components/asset-explorer/NetworkSelectorModal";
import UserAssetList from "@/components/asset-explorer/UserAssetList";
import WalletInfo from "@/components/asset-explorer/WalletInfo";
import { SAMPLE_ASSETS } from "@/constants/dummyData/assets";
import type { TCryptoAsset } from "@/constants/types/assetTypes";
import { useBlockchains } from "@/hooks/queries/useBlockchains";
import { useTokens } from "@/hooks/queries/useTokens";
import {
  useActiveNetwork,
  useActiveTab,
  useAssetSearchQuery,
} from "@/hooks/useAssetExplorerState";
import { useAssetSelection } from "@/hooks/useAssetSelection";
import { useNavigationReady } from "@/hooks/useNavigationReady";
import { useUserAssetsWithBalances } from "@/hooks/useUserAssetsWithBalances";
import { useWallet } from "@/hooks/useWallet";
import {
  adaptAssetForNetwork,
  filterAssets,
  getNetworkSpecificAssets,
} from "@/utils/assetUtils";
import { ALL_NETWORKS } from "@/utils/networkUtils";

export default function AssetExplorer() {
  const ready = useNavigationReady();
  const [_showAddToken, setShowAddToken] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [_isLoading, setIsLoading] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<TCryptoAsset[]>([]);

  const { wallets, activeWalletIndex, activeChain } = useWallet();
  const activeWallet = wallets[activeWalletIndex];

  const { activeTab, setActiveTab } = useActiveTab();
  const { activeNetwork, activeBlockchainId } = useActiveNetwork();
  const { searchQuery } = useAssetSearchQuery();

  const { data: blockchains } = useBlockchains({ isActive: true });

  // Namespace of the network the user is currently browsing in this
  // screen. Falls back to the globally-active chain's namespace when the
  // per-screen selection hasn't synced yet (first render before
  // `NetworkRadioButtons` commits). Drives the wallet-selector filter so
  // adding a Solana asset only surfaces Solana wallets, and vice versa.
  const activeNamespace = useMemo(() => {
    const blockchain = blockchains?.find((b) => b.id === activeBlockchainId);
    if (blockchain) return blockchain.isEVM === false ? "solana" : "eip155";
    return activeChain.namespace;
  }, [blockchains, activeBlockchainId, activeChain.namespace]);

  const walletsForActiveNamespace = useMemo(
    () => wallets.filter((w) => w.namespace === activeNamespace),
    [wallets, activeNamespace],
  );

  const {
    userAssets,
    addAsset,
    removeAsset,
    addCustomToken,
    addMultipleAssets,
    isAssetAdded,
    refetchBalances,
  } = useUserAssetsWithBalances();

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh: drop server-backed caches that the asset explorer
  // reads (token catalogue + blockchain catalogue) and re-fetch balances
  // for the user's added assets. `refetchQueries` forces a round-trip
  // even when the cache is still within `staleTime`, which is the point —
  // the user is explicitly asking "re-sync now".
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ["tokens"],
          exact: false,
        }),
        queryClient.refetchQueries({
          queryKey: ["blockchains"],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: ["userAssets"],
          exact: false,
        }),
      ]);
      refetchBalances();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refetchBalances]);

  const {
    selectionMode,
    selectedAssets,
    currentAsset,
    walletSelectorVisible,
    handleAssetLongPress,
    handleToggleAssetSelection,
    cancelSelectionMode,
    openWalletSelector,
    closeWalletSelector,
    confirmSelection,
    isAssetSelected,
  } = useAssetSelection();

  const { data: tokens, isLoading: isLoadingTokens } = useTokens({
    blockchainId: activeBlockchainId,
    isActive: true,
    // Native currency is implicit for every chain (shown in the balance
    // pill / WalletInfo header), so exclude it from the Explore list.
    isNativeCurrency: false,
  });

  useEffect(() => {
    if (tokens) {
      const tokenAssets = tokens.map((token) => ({
        id: token.id || `token-${token.contractAddress}`,
        name: token.name || "Unknown Token",
        symbol: token.symbol || "???",
        logo: token.logoUrl || token.symbol?.charAt(0) || "?",
        balance: "0",
        value: "0.00",
        change: "0%",
        contractAddress: token.contractAddress,
        decimals: token.decimals,
      }));

      setAvailableAssets(tokenAssets);
    } else if (!activeBlockchainId || !isLoadingTokens) {
      const networkAssets = getNetworkSpecificAssets(
        SAMPLE_ASSETS,
        activeNetwork,
        ALL_NETWORKS,
      );
      setAvailableAssets(networkAssets);
    }
  }, [tokens, isLoadingTokens, activeNetwork, activeBlockchainId]);

  const filteredAvailableAssets = useMemo(
    () =>
      filterAssets(availableAssets, searchQuery).map((asset) =>
        adaptAssetForNetwork(asset, activeNetwork, ALL_NETWORKS),
      ),
    [availableAssets, searchQuery, activeNetwork],
  );

  const filteredUserAssets = useMemo(
    () => filterAssets(userAssets, searchQuery),
    [userAssets, searchQuery],
  );

  const _handleAddCustomToken = useCallback(async () => {
    setIsLoading(true);
    try {
      await addCustomToken(tokenAddress);
      setTokenAddress("");
      setShowAddToken(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, addCustomToken]);

  const handleAddSelectedAssets = useCallback(() => {
    if (selectedAssets.length > 0) {
      openWalletSelector();
    }
  }, [selectedAssets, openWalletSelector]);

  const handleAddAssetsToWallets = useCallback(
    (
      walletIndices: number[],
      _: TCryptoAsset | null,
      assetsToAdd?: TCryptoAsset[],
    ) => {
      if (!assetsToAdd || assetsToAdd.length === 0) return;

      walletIndices.forEach(() => {
        addMultipleAssets(assetsToAdd);
      });

      confirmSelection();
    },
    [addMultipleAssets, confirmSelection],
  );

  const handleAssetPress = useCallback(
    (asset: TCryptoAsset) => {
      if (selectionMode) {
        handleToggleAssetSelection(asset);
      } else {
        openWalletSelector(asset);
      }
    },
    [selectionMode, handleToggleAssetSelection, openWalletSelector],
  );

  if (!ready) {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView
          className="flex-1 bg-light-main-container"
          edges={["top"]}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#c71c4b"]}
              tintColor="#c71c4b"
            />
          }
        >
          <View className="flex-1 px-4 pt-2">
            <AssetExplorerHeader
              selection={{
                selectionMode,
                selectedAssetsCount: selectedAssets.length,
              }}
              onCancel={cancelSelectionMode}
              onAdd={handleAddSelectedAssets}
            />

            {!selectionMode && <WalletInfo activeWallet={activeWallet} />}

            <AssetExplorerTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectionMode={selectionMode}
            />

            {activeTab === "my-assets" ? (
              <UserAssetList
                data={{
                  userAssets,
                  filteredUserAssets,
                  searchQuery,
                }}
                onNavigateToExplore={() => setActiveTab("explore-assets")}
                removeAsset={removeAsset}
              />
            ) : (
              <AvailableAssetList
                data={{
                  filteredAssets: filteredAvailableAssets,
                  searchQuery,
                }}
                state={{
                  isLoading: isLoadingTokens,
                  selectionMode,
                }}
                isAssetAdded={isAssetAdded}
                isAssetSelected={isAssetSelected}
                onAssetPress={handleAssetPress}
                onAssetLongPress={handleAssetLongPress}
                onAddPress={openWalletSelector}
              />
            )}
          </View>
        </ScrollView>
        {!selectionMode && <NetworkRadioButtons />}
      </SafeAreaView>

      <NetworkSelectorModal />

      <AssetWalletSelectorModal
        visible={walletSelectorVisible}
        data={{
          asset: currentAsset,
          assets: selectionMode ? selectedAssets : undefined,
          wallets: walletsForActiveNamespace,
          activeNetwork,
        }}
        onClose={closeWalletSelector}
        onConfirm={(walletIndices, selectedAsset, selectedAssets) => {
          if (selectionMode && selectedAssets) {
            handleAddAssetsToWallets(walletIndices, null, selectedAssets);
          } else if (selectedAsset) {
            addAsset(selectedAsset);
          }
          closeWalletSelector();
        }}
      />
    </>
  );
}

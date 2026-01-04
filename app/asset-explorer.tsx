import { Search, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
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
import { useTokens } from "@/hooks/queries/useTokens";
import {
  useActiveNetwork,
  useActiveTab,
  useAssetSearchQuery,
} from "@/hooks/useAssetExplorerState";
import { useAssetSelection } from "@/hooks/useAssetSelection";
import { useUserAssets } from "@/hooks/useUserAssets";
import { useWallet } from "@/hooks/useWallet";
import {
  adaptAssetForNetwork,
  filterAssets,
  getNetworkSpecificAssets,
} from "@/utils/assetUtils";
import { ALL_NETWORKS } from "@/utils/networkUtils";

export default function AssetExplorer() {
  const [showAddToken, setShowAddToken] = useState(false);
  const [tokenAddress, setTokenAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<TCryptoAsset[]>([]);

  const { wallets, activeWalletIndex } = useWallet();
  const activeWallet = wallets[activeWalletIndex];

  const { activeTab, setActiveTab } = useActiveTab();
  const { activeNetwork, activeBlockchainId } = useActiveNetwork();
  const { searchQuery, setSearchQuery } = useAssetSearchQuery();

  const {
    userAssets,
    addAsset,
    removeAsset,
    addCustomToken,
    addMultipleAssets,
    isAssetAdded,
  } = useUserAssets();

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

  const handleAddCustomToken = useCallback(async () => {
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

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
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

            {!selectionMode && (
              <View
                className="flex-row items-center bg-white rounded-2xl px-4 py-1 my-3"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Search size={20} color="#9ca3af" />
                <TextInput
                  className="flex-1 py-3 px-3 text-light-matte-black text-base"
                  placeholder="Search tokens..."
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    className="p-1"
                  >
                    <X size={18} color="#9ca3af" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setShowAddToken(!showAddToken)}
                    className={`px-3 py-1.5 rounded-xl ${
                      showAddToken ? "bg-light-primary-red" : "bg-gray-100"
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View
                        className={`text-xs font-semibold ${
                          showAddToken ? "text-white" : "text-light-matte-black"
                        }`}
                      >
                        {showAddToken ? (
                          <X size={14} color="#fff" />
                        ) : (
                          <View className="w-3 h-3 rounded-full bg-light-primary-red" />
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}
              </View>
            )}

            {showAddToken && !selectionMode && (
              <AddTokenForm
                state={{
                  tokenAddress,
                  isLoading,
                }}
                onAddressChange={setTokenAddress}
                onSubmit={handleAddCustomToken}
                onClose={() => setShowAddToken(false)}
              />
            )}

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
          wallets,
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

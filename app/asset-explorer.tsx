import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AddTokenForm from "@/components/asset-explorer/AddTokenForm";
import AssetExplorerHeader from "@/components/asset-explorer/AssetExplorerHeader";
import AssetItem from "@/components/asset-explorer/AssetItem";
import AssetTabContent from "@/components/asset-explorer/AssetTabContent";
import AssetWalletSelectorModal from "@/components/asset-explorer/AssetWalletSelectorModal";
import AssetExplorerTabs from "@/components/asset-explorer/MyAssetsAndExploreAssetTabs";
import NetworkRadioButtons from "@/components/asset-explorer/NetworkRadioButtons";
import NetworkSelectorModal from "@/components/asset-explorer/NetworkSelectorModal";
import UserAssetItem from "@/components/asset-explorer/UserAssetItem";
import WalletInfo from "@/components/asset-explorer/WalletInfo";
import SearchBar from "@/components/common/SearchBar";
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
    () => filterAssets(availableAssets, searchQuery),
    [availableAssets, searchQuery],
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

  const renderUserAssetItem = useCallback(
    ({ item }: { item: TCryptoAsset }) => {
      return <UserAssetItem item={item} removeAsset={removeAsset} />;
    },
    [removeAsset],
  );

  const renderAvailableAssetItem = useCallback(
    ({ item }: { item: TCryptoAsset }) => {
      const adaptedItem = adaptAssetForNetwork(
        item,
        activeNetwork,
        ALL_NETWORKS,
      );
      const isAdded = isAssetAdded(adaptedItem.id);
      const isSelected = isAssetSelected(adaptedItem.id);

      return (
        <AssetItem
          item={adaptedItem}
          isAdded={isAdded}
          isSelected={isSelected}
          selectionMode={selectionMode}
          onPress={() => {
            if (selectionMode) {
              handleToggleAssetSelection(adaptedItem);
            } else {
              openWalletSelector(adaptedItem);
            }
          }}
          onLongPress={() => handleAssetLongPress(adaptedItem)}
          onAddPress={() => openWalletSelector(adaptedItem)}
        />
      );
    },
    [
      activeNetwork,
      isAssetAdded,
      isAssetSelected,
      selectionMode,
      handleToggleAssetSelection,
      handleAssetLongPress,
      openWalletSelector,
    ],
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <View className="flex-1 p-4">
            <AssetExplorerHeader
              selectionMode={selectionMode}
              selectedAssetsCount={selectedAssets.length}
              cancelSelectionMode={cancelSelectionMode}
              addSelectedAssets={handleAddSelectedAssets}
            />

            {!selectionMode && <WalletInfo activeWallet={activeWallet} />}

            {!selectionMode && (
              <SearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showAddToken={showAddToken}
                setShowAddToken={setShowAddToken}
              />
            )}

            {showAddToken && !selectionMode && (
              <AddTokenForm
                tokenAddress={tokenAddress}
                setTokenAddress={setTokenAddress}
                addCustomToken={handleAddCustomToken}
                isLoading={isLoading}
              />
            )}

            <AssetExplorerTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectionMode={selectionMode}
            />

            <AssetTabContent
              activeTab={activeTab}
              userAssets={userAssets}
              setActiveTab={setActiveTab}
              filteredUserAssets={filteredUserAssets}
              filteredAvailableAssets={filteredAvailableAssets}
              isAssetAdded={isAssetAdded}
              addAsset={addAsset}
              selectionMode={selectionMode}
              searchQuery={searchQuery}
              renderUserAssetItem={renderUserAssetItem}
              renderAvailableAssetItem={renderAvailableAssetItem}
              isLoading={isLoadingTokens && activeTab === "explore-assets"}
            />
          </View>
        </ScrollView>
        {!selectionMode && <NetworkRadioButtons />}
      </SafeAreaView>

      <NetworkSelectorModal />

      <AssetWalletSelectorModal
        visible={walletSelectorVisible}
        asset={currentAsset}
        assets={selectionMode ? selectedAssets : undefined}
        wallets={wallets}
        activeNetwork={activeNetwork}
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

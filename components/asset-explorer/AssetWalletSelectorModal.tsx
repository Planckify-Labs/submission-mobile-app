import { Check, Info } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import type { TAssetWalletSelectorModalProps } from "@/constants/types/assetTypes";
import type { TWallet } from "@/constants/types/walletTypes";
import { loadWalletAssets, saveWalletAssets } from "@/utils/assetUtils";
import OptimizedImage from "../common/OptimizedImage";

const AssetWalletSelectorModal = ({
  visible,
  data,
  onClose,
  onConfirm,
}: TAssetWalletSelectorModalProps) => {
  const { asset, assets, wallets, activeNetwork } = data;

  const [selectedWallets, setSelectedWallets] = useState<number[]>([0]);
  const [walletsWithAsset, setWalletsWithAsset] = useState<
    Record<number, string[]>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  const checkExistingAssets = useCallback(async () => {
    if (!visible) return;

    setIsLoading(true);
    const existingAssetMap: Record<number, string[]> = {};

    const assetsToCheck =
      assets && assets.length > 0 ? assets : asset ? [asset] : [];

    if (assetsToCheck.length === 0) {
      setIsLoading(false);
      return;
    }

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      if (wallet?.address) {
        try {
          const currentAssets = await loadWalletAssets(
            wallet.address,
            activeNetwork,
          );

          const existingAssets = assetsToCheck.filter((assetToCheck) =>
            currentAssets.some((existing) => existing.id === assetToCheck.id),
          );

          if (existingAssets.length > 0) {
            existingAssetMap[i] = existingAssets.map((a) => a.symbol);
          }
        } catch (error) {
          if (__DEV__) console.warn("Error checking wallet assets:", error);
        }
      }
    }

    setWalletsWithAsset(existingAssetMap);
    setIsLoading(false);
  }, [visible, asset, assets, wallets, activeNetwork]);

  useEffect(() => {
    if (visible) {
      setSelectedWallets([0]);
      checkExistingAssets();
    }
  }, [visible, checkExistingAssets]);

  const toggleWalletSelection = useCallback((index: number) => {
    setSelectedWallets((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  }, []);

  const handleConfirm = async () => {
    if (selectedWallets.length === 0) {
      return;
    }

    let hasAddedAssets = false;
    let duplicateCount = 0;
    const duplicateAssets: string[] = [];

    if (assets && assets.length > 0) {
      for (const walletIndex of selectedWallets) {
        const wallet = wallets[walletIndex];
        if (wallet?.address) {
          try {
            const currentAssets = await loadWalletAssets(
              wallet.address,
              activeNetwork,
            );

            const newAssets = assets.filter(
              (newAsset) =>
                !currentAssets.some((existing) => existing.id === newAsset.id),
            );

            const duplicates = assets.filter((newAsset) =>
              currentAssets.some((existing) => existing.id === newAsset.id),
            );

            duplicateCount += duplicates.length;
            duplicates.forEach((dupe) => {
              if (!duplicateAssets.includes(dupe.symbol)) {
                duplicateAssets.push(dupe.symbol);
              }
            });

            if (newAssets.length > 0) {
              hasAddedAssets = true;
              const updatedAssets = [...currentAssets, ...newAssets];
              await saveWalletAssets(
                wallet.address,
                activeNetwork,
                updatedAssets,
              );
            }
          } catch (error) {
            if (__DEV__) console.warn("Error saving assets to wallet:", error);
          }
        }
      }
    } else if (asset) {
      for (const walletIndex of selectedWallets) {
        const wallet = wallets[walletIndex];
        if (wallet?.address) {
          try {
            const currentAssets = await loadWalletAssets(
              wallet.address,
              activeNetwork,
            );

            if (!currentAssets.some((existing) => existing.id === asset.id)) {
              hasAddedAssets = true;
              const updatedAssets = [...currentAssets, asset];
              await saveWalletAssets(
                wallet.address,
                activeNetwork,
                updatedAssets,
              );
            } else {
              duplicateCount++;
              if (!duplicateAssets.includes(asset.symbol)) {
                duplicateAssets.push(asset.symbol);
              }
            }
          } catch (error) {
            if (__DEV__) console.warn("Error saving asset to wallet:", error);
          }
        }
      }
    }

    if (__DEV__ && duplicateCount > 0) {
      const assetNames = duplicateAssets.join(", ");
      console.warn(
        hasAddedAssets
          ? `Partial addition: some assets added, but ${duplicateCount} were already present.`
          : `Already added: ${assetNames} ${
              duplicateAssets.length > 1 ? "are" : "is"
            } already in the selected wallet(s) on this network.`,
      );
    }

    if (hasAddedAssets) {
      onConfirm(selectedWallets, asset, assets);
    } else {
      onClose();
    }
  };

  const renderWalletItem = useCallback(
    (wallet: TWallet, index: number) => {
      const isSelected = selectedWallets.includes(index);
      const existingAssets = walletsWithAsset[index] || [];
      const hasExistingAssets = existingAssets.length > 0;

      return (
        <Pressable
          key={wallet.address}
          className={`flex-row items-center p-4 mb-2 rounded-xl ${
            isSelected ? "bg-light-primary-red/10" : "bg-light-main-container"
          }`}
          onPress={() => toggleWalletSelection(index)}
        >
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="font-bold text-light-matte-black">
                {wallet.name || `Wallet ${index + 1}`}
              </Text>

              {hasExistingAssets && (
                <View className="ml-2 px-2 py-0.5 bg-light-matte-black/10 rounded-full">
                  <Text className="text-xs text-light-matte-black/60">
                    Has{" "}
                    {existingAssets.length === 1
                      ? existingAssets[0]
                      : `${existingAssets.length} assets`}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-light-matte-black/70">
              {wallet.address.substring(0, 6)}...
              {wallet.address.substring(wallet.address.length - 4)}
            </Text>

            {hasExistingAssets && existingAssets.length > 1 && (
              <Text className="text-xs text-light-matte-black/50 mt-1">
                Already has: {existingAssets.join(", ")}
              </Text>
            )}
          </View>

          <View
            className={`w-6 h-6 rounded-full items-center justify-center ${
              isSelected
                ? "bg-light-primary-red"
                : hasExistingAssets
                  ? "bg-light-matte-black/20"
                  : "border border-light-matte-black/20"
            }`}
          >
            {isSelected ? (
              <Check size={14} color="#fff" strokeWidth={3} />
            ) : (
              hasExistingAssets && <Info size={14} color="#555" />
            )}
          </View>
        </Pressable>
      );
    },
    [selectedWallets, walletsWithAsset, toggleWalletSelection],
  );

  const isMultipleAssets = assets && assets.length > 0;
  const assetsToShow = isMultipleAssets ? assets : asset ? [asset] : [];
  const assetCount = assetsToShow.length;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      height="67%"
      backgroundColor="#fff"
      contentClassName="px-6"
    >
      <ModalHeader title="Select Wallet" />

      {assetsToShow.length > 0 && (
        <View className="bg-light-main-container p-4 rounded-xl mb-4">
          <Text className="text-light-matte-black/60 mb-1">
            {isMultipleAssets ? "Adding Multiple Assets" : "Adding Asset"}
          </Text>

          {isMultipleAssets ? (
            <View>
              <Text className="text-light-matte-black font-bold">
                {assetCount} asset{assetCount > 1 ? "s" : ""} selected
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-2"
              >
                {assetsToShow.slice(0, 5).map((item) => (
                  <View key={item.id} className="flex-row items-center mr-3">
                    <View className="w-6 aspect-square bg-light-primary-red/10 overflow-hidden rounded-full items-center justify-center mr-1">
                      <OptimizedImage
                        source={{ uri: item.logo }}
                        style={{ width: 20, height: 20 }}
                        contentFit="contain"
                        alt={`${item.name} logo`}
                      />
                    </View>
                    <Text className="text-light-matte-black text-xs">
                      {item.symbol}
                    </Text>
                  </View>
                ))}
                {assetCount > 5 && (
                  <Text className="text-light-matte-black/60 text-xs ml-1">
                    +{assetCount - 5} more
                  </Text>
                )}
              </ScrollView>
            </View>
          ) : (
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-light-primary-red/10 rounded-full items-center justify-center mr-2">
                {asset && (
                  <OptimizedImage
                    source={{ uri: asset.logo }}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                    alt={`${asset.name} logo`}
                  />
                )}
              </View>
              <Text className="text-light-matte-black font-bold">
                {asset?.name} ({asset?.symbol})
              </Text>
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <View className="items-center py-4">
          <Text className="text-light-matte-black/60">Checking wallets...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {wallets.map((wallet, index) => renderWalletItem(wallet, index))}
        </ScrollView>
      )}

      <Pressable
        className="bg-light-primary-red py-3 rounded-xl my-4"
        onPress={handleConfirm}
        disabled={selectedWallets.length === 0}
      >
        <Text className="text-white font-bold text-center">Confirm</Text>
      </Pressable>
    </BaseModal>
  );
};

export default AssetWalletSelectorModal;

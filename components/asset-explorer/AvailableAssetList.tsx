import { Coins, SearchX } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import type { TCryptoAsset } from "@/constants/types/assetTypes";
import AssetItem from "./AssetItem";
import AssetLoadingSkeletons from "./AssetLoadingSkeletons";

type TAvailableAssetListProps = {
  data: {
    filteredAssets: TCryptoAsset[];
    searchQuery: string;
  };
  state: {
    isLoading: boolean;
    selectionMode: boolean;
  };
  isAssetAdded: (id: string) => boolean;
  isAssetSelected: (id: string) => boolean;
  onAssetPress: (asset: TCryptoAsset) => void;
  onAssetLongPress: (asset: TCryptoAsset) => void;
  onAddPress: (asset: TCryptoAsset) => void;
};

const AvailableAssetList = ({
  data,
  state,
  isAssetAdded,
  isAssetSelected,
  onAssetPress,
  onAssetLongPress,
  onAddPress,
}: TAvailableAssetListProps) => {
  const { filteredAssets, searchQuery } = data;
  const { isLoading, selectionMode } = state;

  if (isLoading) {
    return <AssetLoadingSkeletons count={5} />;
  }

  if (filteredAssets.length === 0) {
    return (
      <View className="items-center justify-center py-12 px-6">
        <View
          className={`w-16 h-16 rounded-2xl items-center justify-center mb-4 ${
            searchQuery ? "bg-gray-100" : "bg-light-matte-black/5"
          }`}
        >
          {searchQuery ? (
            <SearchX size={28} color="#9ca3af" />
          ) : (
            <Coins size={28} color="#20222c" />
          )}
        </View>
        <Text className="text-light-matte-black font-bold text-lg mb-1 text-center">
          {searchQuery ? "No Results" : "No Assets Available"}
        </Text>
        <Text className="text-light-matte-black/50 text-center">
          {searchQuery
            ? `No assets match "${searchQuery}"`
            : "Check back later for new tokens"}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-0">
      {selectionMode && (
        <Text className="text-light-matte-black/50 text-xs mb-3 px-1">
          Long press to select multiple assets
        </Text>
      )}
      {filteredAssets.map((item) => (
        <AssetItem
          key={item.id}
          item={item}
          state={{
            isAdded: isAssetAdded(item.id),
            isSelected: isAssetSelected(item.id),
            selectionMode,
          }}
          actions={{
            onPress: () => onAssetPress(item),
            onLongPress: () => onAssetLongPress(item),
            onAddPress: () => onAddPress(item),
          }}
        />
      ))}
    </View>
  );
};

export default AvailableAssetList;

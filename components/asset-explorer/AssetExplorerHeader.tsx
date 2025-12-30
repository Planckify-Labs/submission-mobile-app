import { Check, X } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { TAssetExplorerHeaderProps } from "@/constants/types/assetTypes";

const AssetExplorerHeader = ({
  selection,
  onCancel,
  onAdd,
}: TAssetExplorerHeaderProps) => {
  const { selectionMode, selectedAssetsCount } = selection;
  return (
    <View className="flex-row justify-between items-center mb-4">
      <Text className="text-2xl font-bold text-light-matte-black">
        {selectionMode ? "Select Assets" : "Asset Explorer"}
      </Text>

      {selectionMode && (
        <View className="flex-row">
          <Pressable
            onPress={onCancel}
            className="bg-light-main-container p-2 rounded-full mr-2"
          >
            <X size={20} color="#20222c" />
          </Pressable>

          <Pressable
            onPress={onAdd}
            disabled={selectedAssetsCount === 0}
            className={`${
              selectedAssetsCount > 0
                ? "bg-light-primary-red"
                : "bg-light-primary-red/50"
            } px-3 py-2 rounded-full flex-row items-center`}
          >
            <Check size={16} color="#fff" className="mr-1" />
            <Text className="text-white font-medium">
              Add {selectedAssetsCount > 0 ? `(${selectedAssetsCount})` : ""}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

export default AssetExplorerHeader;

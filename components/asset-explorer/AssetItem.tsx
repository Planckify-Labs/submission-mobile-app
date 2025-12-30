import { Check, Plus } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import OptimizedImage from "@/components/common/OptimizedImage";
import type { TAssetItemProps } from "@/constants/types/assetTypes";

const AssetItem = ({ item, state, actions }: TAssetItemProps) => {
  const { isAdded, isSelected, selectionMode } = state;
  const { onPress, onLongPress, onAddPress } = actions;
  return (
    <Pressable
      className="flex-row items-center justify-between p-4 border-b border-light-matte-black/10"
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden">
          <OptimizedImage
            source={{ uri: item.logo }}
            style={{ width: 30, height: 30 }}
            contentFit="contain"
            alt={`${item.name} logo`}
          />
        </View>
        <View className="flex-1">
          <Text className="text-light-matte-black font-medium">
            {item.name}
          </Text>
          <Text className="text-light-matte-black/60">
            {item.symbol} • {item.balance} • ${item.value}
          </Text>
        </View>
      </View>

      {selectionMode ? (
        <View
          className={`w-6 h-6 rounded-full border-2 ${
            isSelected
              ? "bg-light-matte-black border-light-matte-black"
              : "border-light-matte-black/30"
          } items-center justify-center`}
        >
          {isSelected && <Check size={16} color="white" />}
        </View>
      ) : (
        <View className="flex-row items-center">
          {isAdded && (
            <View className="px-2 py-1 rounded-full bg-light-matte-black/10 mr-2">
              <Text className="text-xs text-light-matte-black/60">Added</Text>
            </View>
          )}
          <Pressable
            className="w-8 h-8 rounded-full bg-light-matte-black items-center justify-center"
            onPress={onAddPress}
          >
            <Plus size={18} color="white" />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
};

export default AssetItem;

import { TCryptoAsset } from "@/constants/types/assetTypes";
import { Check, Plus } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

type AssetItemProps = {
  item: TCryptoAsset;
  isAdded: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onAddPress?: () => void;
  networkId?: string;
};

const AssetItem = ({
  item,
  isAdded,
  isSelected = false,
  selectionMode = false,
  onPress,
  onLongPress,
  onAddPress,
}: AssetItemProps) => {
  return (
    <Pressable
      className="flex-row items-center justify-between p-4 border-b border-light-matte-black/10"
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-full bg-light-matte-black/10 items-center justify-center mr-3">
          <Text className="text-lg">{item.logo}</Text>
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

import { router } from "expo-router";
import { ArrowLeft, Check, Layers, X } from "lucide-react-native";
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
    <View className="flex-row items-center justify-between py-2">
      {/* Left side - Back button or Cancel */}
      <Pressable
        onPress={selectionMode ? onCancel : () => router.back()}
        className="w-11 h-11 items-center justify-center rounded-2xl bg-light"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        {selectionMode ? (
          <X size={20} color="#c71c4b" strokeWidth={2} />
        ) : (
          <ArrowLeft size={22} color="#c71c4b" strokeWidth={2} />
        )}
      </Pressable>

      {/* Center - Title */}
      <View className="flex-row items-center">
        <View className="bg-light-primary-red/10 p-2 rounded-xl mr-2">
          <Layers size={18} color="#c71c4b" />
        </View>
        <Text className="text-lg font-bold text-light-matte-black">
          {selectionMode ? `${selectedAssetsCount} Selected` : "Asset Explorer"}
        </Text>
      </View>

      {/* Right side - Add button in selection mode or placeholder */}
      {selectionMode ? (
        <Pressable
          onPress={onAdd}
          disabled={selectedAssetsCount === 0}
          className={`h-10 px-4 rounded-full flex-row items-center justify-center ${
            selectedAssetsCount > 0
              ? "bg-light-primary-red"
              : "bg-light-primary-red/30"
          }`}
          style={{
            shadowColor: selectedAssetsCount > 0 ? "#c71c4b" : "transparent",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: selectedAssetsCount > 0 ? 4 : 0,
          }}
        >
          <Check size={16} color="#fff" />
          <Text className="text-white font-semibold ml-1">Add</Text>
        </Pressable>
      ) : (
        <View className="w-10" />
      )}
    </View>
  );
};

export default AssetExplorerHeader;

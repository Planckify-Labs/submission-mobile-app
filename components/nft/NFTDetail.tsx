import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import type { NFTAsset } from "@/services/indexer/types";

interface NFTDetailProps {
  nft: NFTAsset;
  onTransfer?: () => void;
  onClose?: () => void;
}

export function NFTDetail({ nft, onTransfer, onClose }: NFTDetailProps) {
  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {/* Image */}
      <View className="aspect-square bg-gray-100 dark:bg-gray-800">
        {nft.metadata.imageUrl ? (
          <Image source={{ uri: nft.metadata.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 text-4xl">NFT</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        {/* Title + collection */}
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{nft.metadata.name}</Text>
        <View className="flex-row items-center mt-1 mb-4">
          <Text className="text-sm text-gray-500 dark:text-gray-400">{nft.collection.name}</Text>
          {nft.collection.isVerified && (
            <View className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded ml-2">
              <Text className="text-blue-700 dark:text-blue-300 text-[10px]">Verified</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {nft.metadata.description && (
          <Text className="text-sm text-gray-600 dark:text-gray-300 mb-4">{nft.metadata.description}</Text>
        )}

        {/* Attributes */}
        {nft.metadata.attributes.length > 0 && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Traits</Text>
            <View className="flex-row flex-wrap">
              {nft.metadata.attributes.map((attr, i) => (
                <View key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 mr-2 mb-2 min-w-[80px]">
                  <Text className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{attr.traitType}</Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">{String(attr.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Floor price */}
        {nft.collection.floorPrice != null && (
          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-800 mb-4">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Floor Price</Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-white">{nft.collection.floorPrice.toFixed(4)} ETH</Text>
          </View>
        )}

        {/* Token type + balance for ERC-1155 */}
        {nft.tokenType === "ERC-1155" && nft.balance > 1 && (
          <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-800 mb-4">
            <Text className="text-sm text-gray-500 dark:text-gray-400">Owned</Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-white">{nft.balance}</Text>
          </View>
        )}

        {/* Transfer button */}
        <Pressable onPress={onTransfer} className="bg-blue-600 rounded-xl py-4 items-center mb-4">
          <Text className="text-white font-semibold text-base">Transfer</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

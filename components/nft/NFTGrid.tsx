import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import type { NFTAsset } from "@/services/indexer/types";
import type { NFTCollection } from "@/services/nfts/types";

interface NFTGridProps {
  collections: NFTCollection[];
  onNFTPress?: (nft: NFTAsset) => void;
}

export function NFTGrid({ collections, onNFTPress }: NFTGridProps) {
  return (
    <FlatList
      data={collections}
      keyExtractor={(item) => item.slug ?? item.name}
      renderItem={({ item }) => (
        <View className="mb-4">
          <CollectionHeader collection={item} />
          <View className="flex-row flex-wrap px-2">
            {item.items.map((nft) => (
              <NFTThumbnail key={`${nft.contractAddress}:${nft.tokenId}`} nft={nft} onPress={onNFTPress} />
            ))}
          </View>
        </View>
      )}
    />
  );
}

function CollectionHeader({ collection }: { collection: NFTCollection }) {
  return (
    <View className="flex-row items-center px-4 py-2">
      {collection.imageUrl && (
        <Image source={{ uri: collection.imageUrl }} style={{ width: 24, height: 24, borderRadius: 12 }} className="mr-2" />
      )}
      <Text className="text-base font-semibold text-gray-900 dark:text-white flex-1">
        {collection.name}
      </Text>
      {collection.isVerified && (
        <View className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded mr-2">
          <Text className="text-blue-700 dark:text-blue-300 text-xs">Verified</Text>
        </View>
      )}
      {collection.floorPrice != null && (
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          Floor: {collection.floorPrice.toFixed(4)} ETH
        </Text>
      )}
      <Text className="text-xs text-gray-400 dark:text-gray-500 ml-2">
        {collection.items.length}
      </Text>
    </View>
  );
}

function NFTThumbnail({ nft, onPress }: { nft: NFTAsset; onPress?: (nft: NFTAsset) => void }) {
  return (
    <Pressable onPress={() => onPress?.(nft)} className="w-1/3 p-1">
      <View className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden aspect-square">
        {nft.metadata.imageUrl ? (
          <Image source={{ uri: nft.metadata.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 text-2xl">NFT</Text>
          </View>
        )}
        {nft.isSpam && (
          <View className="absolute top-1 right-1 bg-red-500 px-1 rounded">
            <Text className="text-white text-[10px]">Spam</Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-gray-700 dark:text-gray-300 mt-1 px-1" numberOfLines={1}>
        {nft.metadata.name}
      </Text>
    </Pressable>
  );
}

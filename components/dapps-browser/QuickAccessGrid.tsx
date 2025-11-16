import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Star } from "lucide-react-native";
import React, { memo, useCallback } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import type { TDApp } from "@/constants/dummyData/ecosystemList";

type QuickAccessGridProps = {
  dapps: TDApp[];
  onNavigateToDapp: (url: string) => void;
  isFavorite?: (dappId: string) => boolean;
  onToggleFavorite?: (dapp: TDApp) => void;
};

const DAppItem = memo<{
  dapp: TDApp;
  onPress: (url: string) => void;
  isFavorite?: (dappId: string) => boolean;
  onToggleFavorite?: (dapp: TDApp) => void;
}>(function DAppItem({ dapp, onPress, isFavorite, onToggleFavorite }) {
  const handlePress = useCallback(() => {
    onPress(dapp.url);
  }, [dapp.url, onPress]);

  const handleToggleFavorite = useCallback(
    (e: any) => {
      e.stopPropagation();
      onToggleFavorite?.(dapp);
    },
    [dapp, onToggleFavorite],
  );

  return (
    <Pressable
      onPress={handlePress}
      className="bg-white rounded-2xl p-3 active:opacity-70 mx-1.5 mb-3"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-11 h-11 rounded-xl items-center justify-center mr-2.5 overflow-hidden"
          style={{ backgroundColor: "#c71c4b08" }}
        >
          <Image
            source={{ uri: dapp.logoUrl }}
            style={{ width: 32, height: 32 }}
            contentFit="contain"
            transition={200}
          />
        </View>
        <View className="flex-1">
          <Text
            className="text-light-matte-black font-bold text-xs mb-0.5"
            numberOfLines={1}
          >
            {dapp.name}
          </Text>
          <Text
            className="text-light-matte-black/50 text-[10px]"
            numberOfLines={1}
          >
            {dapp.description}
          </Text>
        </View>
        {isFavorite && onToggleFavorite && (
          <TouchableOpacity
            onPress={handleToggleFavorite}
            className="p-1"
            activeOpacity={0.7}
          >
            <Star
              size={14}
              color="#c71c4b"
              fill={isFavorite(dapp.id) ? "#c71c4b" : "transparent"}
              strokeWidth={2.5}
            />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

const QuickAccessGrid = memo<QuickAccessGridProps>(function QuickAccessGrid({
  dapps,
  onNavigateToDapp,
  isFavorite,
  onToggleFavorite,
}) {
  const displayedDapps = dapps.slice(0, 6);

  const renderDAppItem = useCallback(
    ({ item: dapp }: { item: TDApp }) => (
      <DAppItem
        dapp={dapp}
        onPress={onNavigateToDapp}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
    ),
    [onNavigateToDapp, isFavorite, onToggleFavorite],
  );

  const keyExtractor = useCallback((dapp: TDApp) => dapp.id, []);

  return (
    <View className="px-4 mb-6">
      <View className="mb-4">
        <Text className="text-light-matte-black font-bold text-lg mb-1">
          🔥 Popular DApps
        </Text>
        <Text className="text-light-matte-black/50 text-xs">
          Most loved by the community
        </Text>
      </View>
      <View style={{ minHeight: 200 }}>
        <FlashList
          data={displayedDapps}
          renderItem={renderDAppItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
});

export default QuickAccessGrid;

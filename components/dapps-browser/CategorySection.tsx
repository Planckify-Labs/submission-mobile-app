import { FlashList } from "@shopify/flash-list";
import { ChevronRight } from "lucide-react-native";
import React, { memo, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import type { TDApp, TDAppCategory } from "@/constants/dummyData/ecosystemList";
import DAppCard from "./DAppCard";

type CategorySectionProps = {
  category: TDAppCategory;
  onNavigateToDapp: (url: string) => void;
  onViewAll?: (categoryId: string) => void;
  isFavorite?: (dappId: string) => boolean;
  onToggleFavorite?: (dapp: TDApp) => void;
};

const CategorySection = memo<CategorySectionProps>(function CategorySection({
  category,
  onNavigateToDapp,
  onViewAll,
  isFavorite,
  onToggleFavorite,
}) {
  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll(category.id);
    }
  };

  const renderDAppItem = useCallback(
    ({ item }: { item: TDApp }) => (
      <DAppCard
        dapp={item}
        onPress={onNavigateToDapp}
        variant="compact"
        isFavorite={isFavorite?.(item.id)}
        onToggleFavorite={onToggleFavorite}
      />
    ),
    [onNavigateToDapp, isFavorite, onToggleFavorite],
  );

  const keyExtractor = useCallback((item: TDApp) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={{ width: 14 }} />, []);

  return (
    <View className="mb-6">
      {/* Modern Header with Gradient Background */}
      <View className="px-4 mb-4">
        <View
          className="p-4 rounded-2xl flex-row items-center justify-between"
          style={{
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="flex-1 flex-row items-center">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: "#c71c4b15" }}
            >
              {category.icon(false)}
            </View>
            <View className="flex-1">
              <Text className="text-light-matte-black font-bold text-base mb-0.5">
                {category.title}
              </Text>
              <Text className="text-light-matte-black/50 text-xs">
                {category.description}
              </Text>
            </View>
          </View>
          {onViewAll && category.dapps.length > 3 && (
            <Pressable
              onPress={handleViewAll}
              className="ml-3 flex-row items-center px-3 py-2 rounded-lg active:opacity-70"
              style={{ backgroundColor: "#c71c4b08" }}
            >
              <Text className="text-light-primary-red font-semibold text-xs mr-1">
                All
              </Text>
              <ChevronRight size={14} color="#c71c4b" strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      </View>

      {/* DApps Horizontal FlashList */}
      <View style={{ minHeight: 180 }}>
        <FlashList
          data={category.dapps}
          renderItem={renderDAppItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 10,
          }}
          ItemSeparatorComponent={ItemSeparator}
        />
      </View>
    </View>
  );
});

export default CategorySection;

import {
  getWeb3EcosystemCategories,
  TDApp,
  TDAppCategory,
} from "@/constants/dummyData/ecosystemList";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";
import DAppCard from "./DAppCard";

export type TCategoryTab = "defi" | "dex" | "gaming";

interface CategoryDAppsListProps {
  activeCategory: TCategoryTab;
  onNavigateToDapp: (url: string) => void;
  onCategoryChange?: (category: TCategoryTab) => void;
  horizontalScrollX?: Animated.Value;
}

const { width: screenWidth } = Dimensions.get("window");

export default function DAppList({
  activeCategory,
  onNavigateToDapp,
  onCategoryChange,
  horizontalScrollX,
}: CategoryDAppsListProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const allCategories = getWeb3EcosystemCategories();

  const categoryOrder = ["dex", "defi", "gaming"] as const;
  const mainCategories = categoryOrder
    .map((id) => allCategories.find((category) => category.id === id))
    .filter((category): category is TDAppCategory => Boolean(category));

  const currentIndex = categoryOrder.indexOf(activeCategory);

  useEffect(() => {
    if (scrollViewRef.current && currentIndex >= 0) {
      scrollViewRef.current.scrollTo({
        x: currentIndex * screenWidth,
        animated: true,
      });
    }
  }, [currentIndex]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollX = event.nativeEvent.contentOffset.x;
      const index = Math.round(scrollX / screenWidth);
      const newCategory = categoryOrder[index];

      if (newCategory && newCategory !== activeCategory && onCategoryChange) {
        onCategoryChange(newCategory);
      }
    },
    [activeCategory, onCategoryChange, categoryOrder],
  );

  const handleScroll = horizontalScrollX
    ? Animated.event(
        [{ nativeEvent: { contentOffset: { x: horizontalScrollX } } }],
        { useNativeDriver: false },
      )
    : undefined;

  const renderCategoryPage = (category: TDAppCategory) => {
    return (
      <View key={category.id} style={{ width: screenWidth }} className="pb-16">
        <View className="mx-4 mb-6">
          <View className="bg-gradient-to-r from-light-main-container to-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row items-center mb-3">
              <View
                className={`${category.color} p-3 rounded-2xl mr-4 shadow-sm`}
              >
                {category.icon}
              </View>
              <View className="flex-1">
                <Text className="text-light-matte-black font-bold text-xl tracking-tight">
                  {category.title}
                </Text>
                <View className="h-1 bg-light-primary-red/20 rounded-full mt-1 w-12" />
              </View>
            </View>

            <Text className="text-light-matte-black/70 text-base leading-6 font-medium">
              {category.description}
            </Text>

            <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100">
              <Text className="text-light-matte-black/40 text-xs font-semibold uppercase tracking-wider">
                Explore DApps
              </Text>
              <View className="flex-row space-x-1">
                <View className="w-2 h-2 bg-light-primary-red/30 rounded-full" />
                <View className="w-2 h-2 bg-light-primary-red/50 rounded-full" />
                <View className="w-2 h-2 bg-light-primary-red rounded-full" />
              </View>
            </View>
          </View>
        </View>
        <View className="px-4 gap-4">
          {category.dapps.map((dapp: TDApp) => (
            <DAppCard key={dapp.id} dapp={dapp} onPress={onNavigateToDapp} />
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={handleScroll}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      scrollEventThrottle={16}
      decelerationRate="fast"
      snapToInterval={screenWidth}
      snapToAlignment="start"
    >
      {mainCategories.map(renderCategoryPage)}
    </ScrollView>
  );
}

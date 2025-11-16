import { FlashList } from "@shopify/flash-list";
import { ChevronRight } from "lucide-react-native";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  View,
} from "react-native";
import type { TDApp, TDAppCategory } from "@/constants/dummyData/ecosystemList";
import {
  getPopularDApps,
  getPromotionalItems,
  getWeb3EcosystemCategories,
} from "@/constants/dummyData/ecosystemList";
import { useFavoriteDApps } from "@/hooks/useFavoriteDApps";
import DAppCard from "./DAppCard";
import FeaturedBanner from "./FeaturedBanner";
import QuickAccessGrid from "./QuickAccessGrid";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH * 0.88;
const BANNER_SPACING = 12;

type DAppsHubProps = {
  onNavigateToDapp: (url: string) => void;
};

const DAppsHub = memo<DAppsHubProps>(function DAppsHub({ onNavigateToDapp }) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  const { favoriteDApps, isFavorite, toggleFavorite } = useFavoriteDApps();

  const promotionalItems = getPromotionalItems();
  const popularDapps = getPopularDApps();
  const categories = getWeb3EcosystemCategories();

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollPosition = event.nativeEvent.contentOffset.x;
      const index = Math.round(
        scrollPosition / (BANNER_WIDTH + BANNER_SPACING),
      );
      setActiveBannerIndex(index);
    },
    [],
  );

  const handleViewAllCategory = useCallback((categoryId: string) => {
    console.log("View all for category:", categoryId);
  }, []);

  const handleToggleFavorite = useCallback(
    (dapp: TDApp) => {
      toggleFavorite(dapp);
    },
    [toggleFavorite],
  );

  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const filteredCategories =
    selectedCategoryId === "all"
      ? categories
      : categories.filter((cat) => cat.id === selectedCategoryId);

  const selectedCategoryDapps =
    selectedCategoryId !== "all" ? filteredCategories[0]?.dapps || [] : [];

  const categorySections = useMemo(
    () =>
      filteredCategories.map((category) => ({
        title: category.title,
        description: category.description,
        icon: category.icon,
        id: category.id,
        data: category.dapps,
      })),
    [filteredCategories],
  );

  const renderFavoriteDApp = useCallback(
    ({ item }: { item: TDApp }) => (
      <DAppCard
        dapp={item}
        onPress={onNavigateToDapp}
        variant="compact"
        isFavorite={true}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [onNavigateToDapp, handleToggleFavorite],
  );

  const renderCategoryPill = useCallback(
    ({ item }: { item: TDAppCategory | "all" }) => {
      if (item === "all") {
        return (
          <Pressable
            onPress={() => handleCategorySelect("all")}
            className={`px-4 py-2.5 rounded-full border ${
              selectedCategoryId === "all"
                ? "bg-light-primary-red border-light-primary-red"
                : "bg-white border-light-matte-black/10"
            }`}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <Text
              className={`font-semibold text-sm ${
                selectedCategoryId === "all"
                  ? "text-white"
                  : "text-light-matte-black/70"
              }`}
            >
              All Categories
            </Text>
          </Pressable>
        );
      }

      const category = item as TDAppCategory;
      const isSelected = selectedCategoryId === category.id;
      return (
        <Pressable
          onPress={() => handleCategorySelect(category.id)}
          className={`px-4 py-2.5 rounded-full border flex-row items-center gap-2 ${
            isSelected
              ? "bg-light-primary-red border-light-primary-red"
              : "bg-white border-light-matte-black/10"
          }`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <View className={isSelected ? "opacity-100" : "opacity-70"}>
            {category.icon(isSelected)}
          </View>
          <Text
            className={`font-semibold text-sm ${
              isSelected ? "text-white" : "text-light-matte-black/70"
            }`}
          >
            {category.title}
          </Text>
        </Pressable>
      );
    },
    [selectedCategoryId, handleCategorySelect],
  );

  const renderGridDApp = useCallback(
    ({ item }: { item: TDApp }) => (
      <DAppCard
        dapp={item}
        onPress={onNavigateToDapp}
        variant="grid"
        isFavorite={isFavorite(item.id)}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [onNavigateToDapp, isFavorite, handleToggleFavorite],
  );

  const favoritesKeyExtractor = useCallback((item: TDApp) => item.id, []);
  const categoryKeyExtractor = useCallback(
    (item: TDAppCategory | "all") => (item === "all" ? "all" : item.id),
    [],
  );

  const FavoritesSeparator = useCallback(
    () => <View style={{ width: 12 }} />,
    [],
  );
  const CategorySeparator = useCallback(
    () => <View style={{ width: 8 }} />,
    [],
  );

  const categoryPillsData: (TDAppCategory | "all")[] = ["all", ...categories];

  const renderSectionHeader = useCallback(
    ({ section }: { section: (typeof categorySections)[0] }) => (
      <View className="mb-6">
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
                {section.icon(false)}
              </View>
              <View className="flex-1">
                <Text className="text-light-matte-black font-bold text-base mb-0.5">
                  {section.title}
                </Text>
                <Text className="text-light-matte-black/50 text-xs">
                  {section.description}
                </Text>
              </View>
            </View>
            {section.data.length > 3 && (
              <Pressable
                onPress={() => handleViewAllCategory(section.id)}
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
        <View style={{ minHeight: 180 }}>
          <FlashList
            data={section.data}
            renderItem={({ item }: { item: TDApp }) => (
              <DAppCard
                dapp={item}
                onPress={onNavigateToDapp}
                variant="compact"
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
            keyExtractor={(item: TDApp) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 10,
            }}
            ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
          />
        </View>
      </View>
    ),
    [handleViewAllCategory, onNavigateToDapp, isFavorite, handleToggleFavorite],
  );

  const renderSectionItem = useCallback(() => null, []);

  const sectionKeyExtractor = useCallback(
    (_: any, index: number) => `section-${index}`,
    [],
  );

  return (
    <ScrollView
      className="flex-1 bg-light-main-container"
      showsVerticalScrollIndicator={false}
    >
      <View className="px-4 pt-4 pb-3 flex items-center">
        <Text className="text-light-matte-black font-bold text-3xl mb-2">
          Takumi Ecosystem Hub
        </Text>
        <Text className="text-light-matte-black/60 text-base">
          Explore decentralized apps and services
        </Text>
      </View>

      <View className="mb-5">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={BANNER_WIDTH + BANNER_SPACING}
          snapToAlignment="start"
          contentContainerStyle={{
            paddingHorizontal: (SCREEN_WIDTH - BANNER_WIDTH) / 2,
            gap: BANNER_SPACING,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {promotionalItems.map((item) => (
            <FeaturedBanner
              key={item.id}
              item={item}
              onPress={onNavigateToDapp}
              width={BANNER_WIDTH}
            />
          ))}
        </ScrollView>

        <View className="flex-row justify-center mt-3 gap-2">
          {promotionalItems.map((_, index) => (
            <View
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === activeBannerIndex
                  ? "bg-light-primary-red w-5"
                  : "bg-light-matte-black/20 w-1.5"
              }`}
            />
          ))}
        </View>
      </View>
      {favoriteDApps.length > 0 && (
        <View className="mb-4">
          <View className="px-4 mb-3">
            <Text className="text-light-matte-black font-bold text-base">
              ⭐ Favorites
            </Text>
          </View>
          <View style={{ minHeight: 180 }}>
            <FlashList
              data={favoriteDApps}
              renderItem={renderFavoriteDApp}
              keyExtractor={favoritesKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 5,
              }}
              ItemSeparatorComponent={FavoritesSeparator}
            />
          </View>
        </View>
      )}

      <QuickAccessGrid
        dapps={popularDapps}
        onNavigateToDapp={onNavigateToDapp}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
      />

      <View className="mb-5">
        <View className="px-4 mb-3">
          <Text className="text-light-matte-black font-bold text-lg">
            Browse Categories
          </Text>
        </View>
        <View style={{ minHeight: 50 }} className="mb-4">
          <FlashList
            data={categoryPillsData}
            renderItem={renderCategoryPill}
            keyExtractor={categoryKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 5 }}
            ItemSeparatorComponent={CategorySeparator}
          />
        </View>
      </View>

      {selectedCategoryId === "all" ? (
        <SectionList
          sections={categorySections}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderSectionItem}
          keyExtractor={sectionKeyExtractor}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <View className="px-4 mb-6">
          <View className="mb-4">
            <Text className="text-light-matte-black font-bold text-lg mb-1">
              {filteredCategories[0]?.title}
            </Text>
            <Text className="text-light-matte-black/50 text-xs">
              {filteredCategories[0]?.description}
            </Text>
          </View>
          <View style={{ minHeight: 400 }}>
            <FlashList
              data={selectedCategoryDapps}
              renderItem={renderGridDApp}
              keyExtractor={favoritesKeyExtractor}
              numColumns={2}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      )}
      <View className="h-4" />
    </ScrollView>
  );
});

export default DAppsHub;

import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LayoutGrid } from "lucide-react-native";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { TDapp, TDappCategory } from "@/api/types/dapp";
import {
  useDappCategories,
  useDappsByCategory,
} from "@/hooks/queries/useDapps";
import {
  type TFavoriteRecord,
  useFavoriteDApps,
} from "@/hooks/useFavoriteDApps";
import CategorySectionContainer from "./CategorySectionContainer";
import DAppCard from "./DAppCard";
import DAppCardSkeleton from "./DAppCardSkeleton";
import DappsErrorMessage from "./DappsErrorMessage";
import FeaturedCarousel from "./FeaturedCarousel";
import PopularDApps from "./PopularDApps";

type DAppsHubProps = {
  onNavigateToDapp: (url: string) => void;
};

const CATEGORY_SKELETONS = [0, 1, 2];

// Favorites are stored as denormalized snapshots; widen to the shape the
// shared DAppCard renders. Only the display fields are read.
const favoriteToDapp = (f: TFavoriteRecord): TDapp =>
  ({
    id: f.id,
    name: f.name,
    description: f.description,
    logoUrl: f.logoUrl,
    websiteUrl: f.websiteUrl,
    appearance: f.appearance,
    categoryId: "",
    isPopular: false,
    isSponsor: false,
    isHighlight: false,
    isActive: true,
    isFavorite: true,
    createdAt: "",
    updatedAt: "",
  }) as TDapp;

const DAppsHub = memo<DAppsHubProps>(function DAppsHub({ onNavigateToDapp }) {
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { favoriteDApps, isFavorite, toggleFavorite } = useFavoriteDApps();
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useDappCategories();

  const activeCategories = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => c.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories],
  );

  // Drill-down grid for a single selected category ("" disables the query).
  const selectedQueryId =
    selectedCategoryId === "all" ? "" : selectedCategoryId;
  const { data: selectedDapps, isLoading: selectedLoading } =
    useDappsByCategory(selectedQueryId);

  const handleToggleFavorite = useCallback(
    (dapp: TDapp) => {
      toggleFavorite(dapp);
    },
    [toggleFavorite],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["dapps"] }),
        queryClient.invalidateQueries({ queryKey: ["dapp-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["dapp-promotions"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const renderFavorite = useCallback(
    ({ item }: { item: TFavoriteRecord }) => (
      <DAppCard
        dapp={favoriteToDapp(item)}
        onPress={onNavigateToDapp}
        variant="compact"
        isFavorite
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [onNavigateToDapp, handleToggleFavorite],
  );

  const renderGridDApp = useCallback(
    ({ item }: { item: TDapp }) => (
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

  const renderCategoryPill = useCallback(
    ({ item }: { item: TDappCategory | "all" }) => {
      const isAll = item === "all";
      const id = isAll ? "all" : item.id;
      const isSelected = selectedCategoryId === id;
      return (
        <Pressable
          onPress={() => setSelectedCategoryId(id)}
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
          {isAll ? (
            <LayoutGrid size={16} color={isSelected ? "#fff" : "#c71c4b"} />
          ) : item.iconUrl ? (
            <Image
              source={{ uri: item.iconUrl }}
              style={{ width: 16, height: 16 }}
              contentFit="contain"
            />
          ) : null}
          <Text
            className={`font-semibold text-sm ${
              isSelected ? "text-white" : "text-light-matte-black/70"
            }`}
          >
            {isAll ? "All" : item.name}
          </Text>
        </Pressable>
      );
    },
    [selectedCategoryId],
  );

  const categoryPillsData = useMemo<(TDappCategory | "all")[]>(
    () => ["all", ...activeCategories],
    [activeCategories],
  );

  const pillKeyExtractor = useCallback(
    (item: TDappCategory | "all") => (item === "all" ? "all" : item.id),
    [],
  );
  const favoriteKeyExtractor = useCallback(
    (item: TFavoriteRecord) => item.id,
    [],
  );
  const Separator = useCallback(() => <View style={{ width: 12 }} />, []);
  const PillSeparator = useCallback(() => <View style={{ width: 8 }} />, []);

  const selectedCategory = activeCategories.find(
    (c) => c.id === selectedCategoryId,
  );

  return (
    <ScrollView
      className="flex-1 bg-light-main-container"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#c71c4b"
          colors={["#c71c4b"]}
        />
      }
    >
      <View className="px-4 pt-4 pb-3 flex items-center">
        <Text className="text-light-matte-black font-bold text-3xl mb-2">
          Takumi Ecosystem Hub
        </Text>
        <Text className="text-light-matte-black/60 text-base">
          Explore decentralized apps and services
        </Text>
      </View>

      <FeaturedCarousel onNavigateToDapp={onNavigateToDapp} />

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
              renderItem={renderFavorite}
              keyExtractor={favoriteKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 5,
              }}
              ItemSeparatorComponent={Separator}
            />
          </View>
        </View>
      )}

      <PopularDApps
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
            keyExtractor={pillKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 5 }}
            ItemSeparatorComponent={PillSeparator}
          />
        </View>
      </View>

      {categoriesError ? (
        <DappsErrorMessage
          onRetry={refetchCategories}
          message="Can't load categories right now"
        />
      ) : categoriesLoading ? (
        CATEGORY_SKELETONS.map((i) => (
          <View key={i} className="mb-6">
            <View className="px-4 mb-4">
              <DAppCardSkeleton />
            </View>
            <View className="flex-row px-4">
              <View style={{ marginRight: 14 }}>
                <DAppCardSkeleton variant="compact" />
              </View>
              <DAppCardSkeleton variant="compact" />
            </View>
          </View>
        ))
      ) : selectedCategoryId === "all" ? (
        activeCategories.map((category) => (
          <CategorySectionContainer
            key={category.id}
            category={category}
            onNavigateToDapp={onNavigateToDapp}
            isFavorite={isFavorite}
            onToggleFavorite={handleToggleFavorite}
          />
        ))
      ) : (
        <View className="px-4 mb-6">
          <View className="mb-4">
            <Text className="text-light-matte-black font-bold text-lg mb-1">
              {selectedCategory?.name ?? ""}
            </Text>
            <Text className="text-light-matte-black/50 text-xs">
              {selectedCategory?.description ?? ""}
            </Text>
          </View>
          {selectedLoading ? (
            <View className="flex-row flex-wrap">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className="w-1/2">
                  <DAppCardSkeleton variant="grid" />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ minHeight: 400 }}>
              <FlashList
                data={selectedDapps ?? []}
                renderItem={renderGridDApp}
                keyExtractor={(item: TDapp) => item.id}
                numColumns={2}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      )}
      <View className="h-4" />
    </ScrollView>
  );
});

export default DAppsHub;

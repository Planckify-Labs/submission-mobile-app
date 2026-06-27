import { FlashList } from "@shopify/flash-list";
import React, { memo, useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import type { TDapp } from "@/api/types/dapp";
import { usePopularDapps } from "@/hooks/queries/useDapps";
import { POPULAR_CARD_WIDTH } from "../../constants/dapps-browser";
import { TDAppNavigationProps } from "../../types/dapps-browser";
import { generateSkeletonData } from "../../utils/dappsBrowserUtils";
import DAppCard from "./DAppCard";
import DAppCardSkeleton from "./DAppCardSkeleton";
import DappsErrorMessage from "./DappsErrorMessage";

type PopularDAppsProps = TDAppNavigationProps & {
  isFavorite?: (dappId: string) => boolean;
  onToggleFavorite?: (dapp: TDapp) => void;
};

const PopularDApps = memo<PopularDAppsProps>(function PopularDApps({
  onNavigateToDapp,
  isFavorite,
  onToggleFavorite,
}) {
  const { data: popularDapps, error, refetch } = usePopularDapps();

  const skeletonData = useMemo(
    () => generateSkeletonData(6, "popular-skeleton"),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.id?.startsWith("popular-skeleton-")) {
        return (
          <View style={{ width: POPULAR_CARD_WIDTH }}>
            <DAppCardSkeleton />
          </View>
        );
      }

      return (
        <View style={{ width: POPULAR_CARD_WIDTH }}>
          <DAppCard
            dapp={item}
            onPress={onNavigateToDapp}
            isFavorite={isFavorite?.(item.id)}
            onToggleFavorite={onToggleFavorite}
          />
        </View>
      );
    },
    [onNavigateToDapp, isFavorite, onToggleFavorite],
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={{ width: 16 }} />, []);

  if (error) {
    return (
      <View className="mb-6">
        <View className="px-4 mb-4">
          <Text className="text-light-matte-black font-bold text-lg">
            🔥 Popular DApps
          </Text>
          <Text className="text-light-matte-black/60 text-sm">
            Most loved applications across all categories
          </Text>
        </View>
        <DappsErrorMessage
          onRetry={refetch}
          message="Can't load popular DApps right now"
        />
      </View>
    );
  }

  return (
    <View className="mb-6">
      <View className="px-4 mb-4">
        <Text className="text-light-matte-black font-bold text-lg">
          🔥 Popular DApps
        </Text>
        <Text className="text-light-matte-black/60 text-sm">
          Most loved applications across all categories
        </Text>
      </View>
      <FlashList
        data={
          popularDapps && popularDapps.length > 0 ? popularDapps : skeletonData
        }
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={ItemSeparator}
        numColumns={1}
        className="min-h-[90px]"
      />
    </View>
  );
});

export default PopularDApps;

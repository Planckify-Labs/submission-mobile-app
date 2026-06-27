import React, { memo } from "react";
import { Text, View } from "react-native";
import type { TDapp, TDappCategory } from "@/api/types/dapp";
import { useDappsByCategory } from "@/hooks/queries/useDapps";
import CategorySection from "./CategorySection";
import DappsErrorMessage from "./DappsErrorMessage";

type CategorySectionContainerProps = {
  category: TDappCategory;
  onNavigateToDapp: (url: string) => void;
  onViewAll?: (categoryId: string) => void;
  isFavorite?: (dappId: string) => boolean;
  onToggleFavorite?: (dapp: TDapp) => void;
};

/**
 * Fetches one category's dapps on its own so a slow/failed category never
 * blanks the whole hub — each section loads, errors, and retries
 * independently.
 */
const CategorySectionContainer = memo<CategorySectionContainerProps>(
  function CategorySectionContainer({
    category,
    onNavigateToDapp,
    onViewAll,
    isFavorite,
    onToggleFavorite,
  }) {
    const {
      data: dapps,
      isLoading,
      error,
      refetch,
    } = useDappsByCategory(category.id);

    if (error) {
      return (
        <View className="mb-6">
          <View className="px-4 mb-3">
            <Text className="text-light-matte-black font-bold text-base">
              {category.name ?? ""}
            </Text>
          </View>
          <DappsErrorMessage
            onRetry={refetch}
            message={`Can't load ${category.name} right now`}
          />
        </View>
      );
    }

    return (
      <CategorySection
        category={category}
        dapps={dapps ?? []}
        isLoading={isLoading}
        onNavigateToDapp={onNavigateToDapp}
        onViewAll={onViewAll}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
    );
  },
);

export default CategorySectionContainer;

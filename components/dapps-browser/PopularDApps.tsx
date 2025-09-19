import { getWeb3EcosystemCategories } from "@/constants/dummyData/ecosystemList";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import DAppCard from "./DAppCard";

interface PopularDAppsProps {
  onNavigateToDapp: (url: string) => void;
}

export default function PopularDApps({ onNavigateToDapp }: PopularDAppsProps) {
  const allCategories = getWeb3EcosystemCategories();

  const mainCategories = allCategories.filter((category) =>
    ["defi", "dex", "gaming"].includes(category.id),
  );

  const popularDapps = mainCategories
    .flatMap((category) => category.dapps)
    .filter((dapp) => dapp.isPopular)
    .slice(0, 6);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <View className="flex-row gap-4">
          {popularDapps.map((dapp) => (
            <View key={dapp.id}>
              <DAppCard
                dapp={dapp}
                isCompact={true}
                onPress={onNavigateToDapp}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

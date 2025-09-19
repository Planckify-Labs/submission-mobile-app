import {
  getPromotionalItems,
  TPromotionalItem,
} from "@/constants/dummyData/ecosystemList";
import React from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface PromotionalSliderProps {
  onNavigateToDapp: (url: string) => void;
}

const { width: screenWidth } = Dimensions.get("window");
const PROMO_CARD_WIDTH = screenWidth * 0.85;

export default function PromotionalSlider({
  onNavigateToDapp,
}: PromotionalSliderProps) {
  const promotionalItems = getPromotionalItems();

  const renderPromotionalCard = (item: TPromotionalItem) => (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.8}
      onPress={() => onNavigateToDapp(item.url)}
      className="rounded-3xl p-6 mr-4"
      style={{
        width: PROMO_CARD_WIDTH,
        backgroundColor: item.backgroundColor,
      }}
    >
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          {item.isSponsored && (
            <View className="bg-white/20 px-3 py-1 rounded-full self-start mb-2">
              <Text className="text-white text-xs font-medium">Sponsored</Text>
            </View>
          )}
          <Text className="text-white font-bold text-xl mb-1">
            {item.title}
          </Text>
          <Text className="text-white/80 text-sm font-medium">
            {item.subtitle}
          </Text>
        </View>
        <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text className="text-white/90 text-sm leading-5">
        {item.description}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="mb-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={PROMO_CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {promotionalItems.map(renderPromotionalCard)}
      </ScrollView>
    </View>
  );
}

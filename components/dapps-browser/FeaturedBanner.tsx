import { Image } from "expo-image";
import { Star } from "lucide-react-native";
import React, { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { TDappPromotion } from "@/api/types/dapp";
import { COLORS } from "@/constants/dapps-browser";
import { resolveAppearance } from "@/utils/dappAppearance";

type FeaturedBannerProps = {
  item: TDappPromotion;
  onPress: (url: string) => void;
  width: number;
};

const FeaturedBanner = memo<FeaturedBannerProps>(function FeaturedBanner({
  item,
  onPress,
  width,
}) {
  // Banners want a colored surface, not the white card default.
  const appearance = useMemo(
    () =>
      resolveAppearance(item.appearance, {
        backgroundColor: COLORS.PRIMARY_RED,
        foreground: COLORS.WHITE,
      }),
    [item.appearance],
  );

  const handlePress = () => {
    if (item.targetUrl) onPress(item.targetUrl);
  };

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-3xl overflow-hidden shadow-lg active:opacity-90"
      style={{ width, backgroundColor: appearance.backgroundColor }}
    >
      <View className="p-6 flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          {item.isSponsored && (
            <View className="flex-row items-center mb-2">
              <Star
                size={14}
                color={appearance.foreground}
                fill={appearance.foreground}
              />
              <Text
                className="text-xs font-semibold ml-1"
                style={{ color: appearance.foreground }}
              >
                SPONSORED
              </Text>
            </View>
          )}
          <Text
            className="text-2xl font-bold mb-1"
            style={{ color: appearance.foreground }}
            numberOfLines={1}
          >
            {item.title ?? ""}
          </Text>
          <Text
            className="text-sm font-semibold mb-2 opacity-90"
            style={{ color: appearance.foreground }}
            numberOfLines={1}
          >
            {item.subtitle ?? ""}
          </Text>
          <Text
            className="text-sm opacity-80"
            style={{ color: appearance.foreground }}
            numberOfLines={2}
          >
            {item.description ?? ""}
          </Text>
        </View>
        <View className="w-20 h-20 rounded-2xl bg-white/20 items-center justify-center overflow-hidden">
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
            transition={200}
          />
        </View>
      </View>
    </Pressable>
  );
});

export default FeaturedBanner;

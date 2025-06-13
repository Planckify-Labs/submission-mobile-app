import React from "react";
import { Pressable, Text, View } from "react-native";

export interface TPromotionBannerProps {
  title: string;
  description: string;
  buttonText: string;
  onPress?: () => void;
}

export default function PromotionBanner({
  title,
  description,
  buttonText,
  onPress,
}: TPromotionBannerProps) {
  return (
    <View className="px-4 mb-4">
      <View className="bg-light-primary-red rounded-xl h-40 overflow-hidden">
        <View className="flex-1 p-4 justify-center">
          <Text className="text-white font-bold text-xl mb-1">{title}</Text>
          <Text className="text-white/90 mb-3">{description}</Text>
          <Pressable
            className="bg-white rounded-full px-4 py-2 self-start"
            onPress={onPress}
          >
            <Text className="text-light-primary-red font-bold">
              {buttonText}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

import { ArrowLeft } from "lucide-react-native";
import React, { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface ScreenHeaderProps {
  title: string;
  onBackPress: () => void;
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  onBackPress,
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center mb-6">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onBackPress}
        className="mr-4"
      >
        <ArrowLeft color="#c71c4b" size={24} />
      </TouchableOpacity>
      <Text className="text-light-matte-black text-xl font-bold">{title}</Text>
    </View>
  );
});

import { ArrowUpRight } from "lucide-react-native";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { TDApp } from "@/constants/dummyData/ecosystemList";

interface DAppCardProps {
  dapp: TDApp;
  isCompact?: boolean;
  onPress: (url: string) => void;
}

export default function DAppCard({
  dapp,
  isCompact = false,
  onPress,
}: DAppCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(dapp.url)}
      className={`bg-white rounded-2xl p-4 border border-gray-100 min-w-[170px]`}
    >
      <View className="flex-row items-center mb-2">
        <View className="w-10 h-10 rounded-full bg-light-main-container items-center justify-center mr-3">
          <Image
            source={{ uri: dapp.logoUrl }}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </View>
        <View className="flex-1">
          <Text className="text-light-matte-black font-bold text-sm text-ellipsis w-fit">
            {dapp.name}
          </Text>
          {dapp.isPopular && (
            <View className="flex-row items-center mt-1">
              <Text className="text-light-primary-red text-xs font-medium ml-1">
                🔥 Popular
              </Text>
            </View>
          )}
        </View>
        <ArrowUpRight color="#c71c4b" size={16} />
      </View>
      <Text
        className="text-light-matte-black/60 text-xs leading-4 text-ellipsis"
        numberOfLines={isCompact ? 2 : 3}
      >
        {dapp.description}
      </Text>
    </TouchableOpacity>
  );
}

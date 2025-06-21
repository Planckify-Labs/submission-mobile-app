import { router } from "expo-router";
import { Settings } from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function PinnedTokens() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex gap-2 flex-row px-2">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <View
              key={i}
              className="rounded-xl border-2 border-light-matte-black/65 aspect-video p-4 w-[190px]"
            >
              <View className="flex-row gap-2 items-center mb-4">
                <View className="aspect-square w-6 bg-light-matte-black/65 rounded-full" />
                <Text className="text-light-matte-black/50 font-bold text-xs">
                  IDRX
                </Text>
              </View>
              <View>
                <Text className="text-light-primary-red font-bold text-xl ml-auto">
                  99.89
                </Text>
                <Text className="text-light-matte-black/65 text-sm ml-auto">
                  Rp.16,000
                </Text>
              </View>
            </View>
          ))}
        <TouchableOpacity
          activeOpacity={0.5}
          onPress={() => router.push("/asset-explorer")}
          className="rounded-xl aspect-square items-center justify-center"
        >
          <Settings size={60} strokeWidth={1} stroke="#77787e" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

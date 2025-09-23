import { router } from "expo-router";
import { Settings } from "lucide-react-native";
import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { usePinnedTokens } from "@/hooks/usePinnedTokens";
import PinnedTokenCard from "../common/PinnedTokenCard";

export default function PinnedTokens() {
  const { pinnedTokens } = usePinnedTokens();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex gap-2 flex-row px-2">
        {pinnedTokens?.map((token) => (
          <PinnedTokenCard key={token.symbol} token={token} />
        ))}
        <TouchableOpacity
          activeOpacity={0.5}
          onPress={() => router.push("/pinned-token-setting")}
          className="rounded-xl aspect-square items-center justify-center"
        >
          <Settings size={60} strokeWidth={1} stroke="#77787e" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

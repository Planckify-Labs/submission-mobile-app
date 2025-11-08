import { FlashList } from "@shopify/flash-list";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { AGENT_QUICK_PROMPTS } from "@/constants/agent";

export interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

export default function QuickPrompts({ onSelectPrompt }: QuickPromptsProps) {
  return (
    <View className="py-5 bg-light-main-container mb-[47px]">
      <Text className="text-lg font-semibold text-light-matte-black/80 mx-4 mb-2">
        What can I help you with?
      </Text>

      <FlashList
        data={AGENT_QUICK_PROMPTS}
        nestedScrollEnabled
        renderItem={({ item }) => (
          <TouchableOpacity
            className="min-w-[140px] border border-light-matte-black/10 max-w-[200px] px-3 py-3 rounded-full bg-light/10 justify-center items-center"
            onPress={() => onSelectPrompt(item.prompt)}
          >
            <Text
              className="text-sm font-bold text-light-matte-black/40 text-center leading-tight"
              numberOfLines={2}
            >
              {item.prompt}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        numColumns={1}
      />
    </View>
  );
}

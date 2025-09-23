import React from "react";
import { Text, View } from "react-native";

export const PINNEDTOKEN_KEY = "takumipay_user_pinned_tokens";

export default function PinnedTokenCard({
  token,
}: {
  token?: { symbol?: string; balance?: string; price?: string };
}) {
  return (
    <View className="rounded-xl border-2 border-light-matte-black/65 aspect-video p-4 w-[190px]">
      <View className="flex-row gap-2 items-center mb-4">
        <View className="aspect-square w-6 bg-light-primary-red/20 rounded-full items-center justify-center">
          <Text className="text-light-primary-red font-bold text-xs">
            {token?.symbol?.charAt(0) || "T"}
          </Text>
        </View>
        <Text className="text-light-matte-black/50 font-bold text-xs">
          {token?.symbol || "TOKEN"}
        </Text>
      </View>
      <View>
        <Text className="text-light-primary-red font-bold text-xl ml-auto">
          {token?.balance || "0.00"}
        </Text>
        <Text className="text-light-matte-black/65 text-sm ml-auto">
          {token?.price ? `Rp.${token.price}` : "N/A"}
        </Text>
      </View>
    </View>
  );
}

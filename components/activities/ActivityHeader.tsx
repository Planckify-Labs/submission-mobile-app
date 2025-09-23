import React, { useState } from "react";
import { Animated, View } from "react-native";
import SearchBar from "@/components/common/SearchBar";

export default function ActivityHeader({
  placeholder,
  searchBarOpacity,
}: {
  placeholder: string;
  searchBarOpacity: Animated.AnimatedAddition<number>;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View className="flex-row items-center justify-between absolute left-0 right-0 z-50">
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        variant="borderedMinimal"
        placeholder={placeholder}
        className="px-4 mt-0 mb-0 w-full"
        searchBarOpacity={searchBarOpacity}
      />
    </View>
  );
}

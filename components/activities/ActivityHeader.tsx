import SearchBar from "@/components/common/SearchBar";
import React, { useState } from "react";
import { View } from "react-native";

export default function ActivityHeader({
  placeholder,
}: { placeholder: string }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View className="flex-row items-center justify-between">
      <SearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        variant="borderedMinimal"
        placeholder={placeholder}
        className="px-4 mt-2 mb-0 w-full"
      />
    </View>
  );
}

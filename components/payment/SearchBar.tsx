import { BlurView } from "expo-blur";
import { Search, X } from "lucide-react-native";
import React from "react";
import { Animated, Pressable, TextInput, View } from "react-native";

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchBarOpacity: Animated.AnimatedAddition<number>;
}

export default function SearchBar({
  searchQuery,
  setSearchQuery,
  searchBarOpacity,
}: SearchBarProps) {
  return (
    <View className="px-4 mt-2 mb-4">
      <BlurView
        intensity={30}
        experimentalBlurMethod="dimezisBlurView"
        className="overflow-hidden rounded-full"
      >
        <View className="overflow-hidden rounded-full border-4 border-light-matte-black relative">
          <Animated.View
            style={{ opacity: searchBarOpacity }}
            className="absolute -z-50 bg-light w-full h-full left-0 right-0 rounded-full"
          >
            <View />
          </Animated.View>
          <View className="flex-row items-center px-3">
            <Search size={18} color="#20222c" />
            <TextInput
              className="flex-1 py-3 px-2 text-light-matte-black"
              placeholder="search services..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <X size={18} color="#20222c" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

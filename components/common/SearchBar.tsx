import { BlurView } from "expo-blur";
import { Search, X } from "lucide-react-native";
import React from "react";
import { Animated, Pressable, TextInput, View } from "react-native";

type SearchBarVariant = "borderedMinimal" | "cleanRed";

type SearchBarProps = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showAddToken?: boolean;
  setShowAddToken?: (show: boolean) => void;
  searchBarOpacity?: Animated.AnimatedAddition<number>;
  variant?: SearchBarVariant;
  placeholder?: string;
  className?: string;
};

const SearchBar = ({
  searchQuery,
  setSearchQuery,
  showAddToken,
  setShowAddToken,
  searchBarOpacity,
  variant = "cleanRed",
  placeholder = "Search assets...",
  className = "w-full",
}: SearchBarProps) => {
  const effectiveVariant =
    showAddToken !== undefined && setShowAddToken !== undefined
      ? "cleanRed"
      : variant;

  if (effectiveVariant === "borderedMinimal") {
    return (
      <View className={`px-4 mt-2 mb-4 ${className}`}>
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
                placeholder={placeholder}
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

  return (
    <View className={`flex-row items-center mb-4 gap-2 ${className}`}>
      <View className="flex-1 bg-light rounded-xl flex-row items-center px-3 shadow-sm">
        <Search size={18} color="#20222c" />
        <TextInput
          className="flex-1 py-3 px-2 text-light-matte-black"
          placeholder={placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <X size={18} color="#20222c" />
          </Pressable>
        ) : null}
      </View>
      {showAddToken !== undefined && setShowAddToken && (
        <Pressable
          onPress={() => setShowAddToken(!showAddToken)}
          className="bg-light-primary-red rounded-xl p-3"
        >
          {showAddToken ? (
            <X size={18} color="white" />
          ) : (
            <Search size={18} color="white" />
          )}
        </Pressable>
      )}
    </View>
  );
};

export default SearchBar;

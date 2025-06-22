import { Search, X } from "lucide-react-native";
import React from "react";
import { Pressable, TextInput, View } from "react-native";

export default function ActivityHeader() {
  return (
    <View className="flex-row items-center justify-between px-4">
      <View className="flex-row items-center px-3 border-4 rounded-full">
        <Search size={18} color="#20222c" />
        <TextInput
          className="flex-1 py-3 px-2 text-light-matte-black"
          placeholder="search transactions..."
        />
        <Pressable>
          <X size={18} color="#20222c" />
        </Pressable>
      </View>
    </View>
  );
}

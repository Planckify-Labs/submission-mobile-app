import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

export default function PaymentHeader({ title }: { title: string }) {
  return (
    <View className="flex-row items-center p-4">
      <Pressable onPress={() => router.back()} className="mr-4">
        <ArrowLeft color="#c71c4b" size={24} />
      </Pressable>
      <Text className="text-light-matte-black text-xl font-bold">{title}</Text>
    </View>
  );
}

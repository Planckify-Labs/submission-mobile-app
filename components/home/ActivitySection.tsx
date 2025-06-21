import { MoveRight, Send } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

export default function ActivitySection() {
  return (
    <View className="px-4">
      <View className="bg-light rounded-[14px] w-full p-[22px] gap-4">
        <View className="flex-row">
          <Text className="text-light-matte-black text-sm">Send & Recieve</Text>
          <Pressable className="flex-row items-center justify-center border-2 ml-auto border-light-primary-red bg-light-primary-red/10 gap-2 rounded-full px-4 py-1">
            <Text className="text-light-matte-black text-sm font-bold">
              View All
            </Text>
            <MoveRight size={20} color="#c71c4b" />
          </Pressable>
        </View>
        <View className="flex-row justify-between">
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="justify-center items-center">
              <View className="aspect-square w-[70px] relative bg-light-primary-red rounded-full items-center justify-center p-3">
                <Text className="text-light font-bold text-sm">
                  0xf322..e34fa
                </Text>
                <View className="bg-emerald-500 aspect-square w-6 rounded-full absolute bottom-0 right-0"></View>
              </View>
              <Text className="text-light-matte-black text-center text-sm font-bold">
                ENS.eth
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row justify-between gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="items-center justify-center">
              <View className="bg-light-primary-red/10 rounded-xl aspect-square w-20 items-center justify-center">
                <Send color="#c71c4b" size={35} />
              </View>
              <Text className="text-light-matte-black text-center text-sm font-bold">
                Transfer
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

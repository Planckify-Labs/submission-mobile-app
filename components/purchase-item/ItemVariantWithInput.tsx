import { router } from "expo-router";
import { ArrowLeft, ChevronRight, Info } from "lucide-react-native";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

export default function ItemWithInput() {
  const [selectedItemVariant, setSelectedItemVariant] = useState<string | null>(
    null,
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View className="flex-1 p-6">
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft color="#c71c4b" size={24} />
          </Pressable>
          <Text className="text-light-matte-black text-xl font-bold">
            Telkomsel Data
          </Text>
        </View>

        <View className="bg-light rounded-xl py-5 mb-6 shadow-sm">
          <View className="mb-6 px-5">
            <Text className="text-light-matte-black/70 mb-2">Phone Number</Text>
            <View className="bg-light-main-container p-4 rounded-xl flex-row items-center justify-between">
              <View>
                <Text className="text-light-matte-black font-medium text-lg">
                  085930970697
                </Text>
                <Text className="text-light-matte-black/60 text-xs">
                  Telkomsel Prepaid
                </Text>
              </View>
              <View className="flex-row items-center">
                <Image
                  source={{
                    uri: "https://upload.wikimedia.org/wikipedia/id/thumb/5/55/XL_logo_2016.svg/422px-XL_logo_2016.svg.png?20210830161224",
                  }}
                  className="w-8 h-8 mr-2"
                  style={{ resizeMode: "contain" }}
                />
              </View>
            </View>
          </View>

          <View className="bg-light-primary-red/10 p-4 mx-5 rounded-xl mb-6">
            <View className="flex-row items-center gap-2">
              <Info size={18} color="#c71c4b" className="mr-2" />
              <Text className="text-light-matte-black/80 text-sm flex-1">
                Have a postpaid number? Click here
              </Text>
              <ChevronRight size={16} color="#c71c4b" />
            </View>
          </View>

          <View>
            <Text className="text-light-matte-black/70 mx-5 mb-3">
              Recently used numbers
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-2"
            >
              <View className="mx-5 flex-row gap-2">
                {["085930970697", "088975163714", "081234567890"].map(
                  (number) => (
                    <Pressable
                      key={number}
                      className="bg-light-main-container border border-light-matte-black/10 rounded-xl p-3 mr-3"
                    >
                      <Text className="text-light-matte-black">{number}</Text>
                    </Pressable>
                  ),
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        <View className="bg-light rounded-xl p-5 mb-6 shadow-sm">
          <Text className="text-light-matte-black font-bold text-lg mb-4">
            Select Data Package
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {[
              {
                value: "5rb",
                days: "7 hari",
                price: "Rp5.900",
                data: "1 GB",
              },
              {
                value: "10rb",
                days: "15 hari",
                price: "Rp10.900",
                data: "3 GB",
              },
              {
                value: "15rb",
                days: "20 hari",
                price: "Rp15.000",
                data: "5 GB",
              },
              {
                value: "25rb",
                days: "30 hari",
                price: "Rp25.000",
                data: "8 GB",
              },
              {
                value: "30rb",
                days: "45 hari",
                price: "Rp30.000",
                data: "10 GB",
              },
              {
                value: "50rb",
                days: "45 hari",
                price: "Rp50.000",
                data: "15 GB",
              },
              {
                value: "100rb",
                days: "60 hari",
                price: "Rp100.000",
                data: "30 GB",
              },
              {
                value: "150rb",
                days: "90 hari",
                price: "Rp150.000",
                data: "50 GB",
              },
            ].map((option) => (
              <Pressable
                key={option.value}
                className={`bg-light-main-container border ${
                  selectedItemVariant === option.value
                    ? "border-light-primary-red bg-light-primary-red/5"
                    : "border-light-matte-black/10"
                } rounded-xl p-4 mb-3 w-[48%]`}
                onPress={() => setSelectedItemVariant(option.value)}
              >
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-light-matte-black font-bold">
                    {option.data}
                  </Text>
                  <View className="bg-light-matte-black/10 px-2 py-1 rounded-full">
                    <Text className="text-light-matte-black/70 text-xs">
                      {option.days}
                    </Text>
                  </View>
                </View>
                <Text className="text-light-primary-red font-bold text-lg">
                  {option.price}
                </Text>
                <Text className="text-light-matte-black/70 text-xs mt-1">
                  4G/5G Network
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          className={`bg-light-primary-red py-4 rounded-full items-center ${!selectedItemVariant ? "opacity-50" : ""}`}
          disabled={!selectedItemVariant}
        >
          <Text className="text-light font-bold text-lg">
            Continue to Payment
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

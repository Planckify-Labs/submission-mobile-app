import ActivityHeader from "@/components/activities/ActivityHeader";
import PurchaseCard from "@/components/activities/PurchaseCard";
import TransferCard from "@/components/activities/TransferCard";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import React, { useState } from "react";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PURCHASE_DATA = Array.from({ length: 60 }).map((_, i) => ({
  id: `purchase-${i}`,
}));
const TRANSFER_DATA = Array.from({ length: 60 }).map((_, i) => ({
  id: `transfer-${i}`,
}));

export default function ActivitiesScreen() {
  const [activeActivity, setActiveActivity] = useState<
    "purchase" | "transfers"
  >("purchase");

  const renderActivityList = () => {
    const data = activeActivity === "purchase" ? PURCHASE_DATA : TRANSFER_DATA;
    const RenderItem =
      activeActivity === "purchase" ? PurchaseCard : TransferCard;

    return (
      <FlashList
        data={data}
        estimatedItemSize={60}
        keyExtractor={(item) => item.id}
        renderItem={() => <RenderItem />}
        ItemSeparatorComponent={() => <View className="h-4" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 96,
        }}
      />
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        className="flex-1 bg-light-main-container relative"
        edges={["top"]}
      >
        <ActivityHeader />
        {renderActivityList()}

        <BlurView
          intensity={30}
          experimentalBlurMethod="dimezisBlurView"
          className="overflow-hidden rounded-full absolute bottom-4 left-0 right-0 mx-4 border-4 border-light-main-container/80"
        >
          <View className="bg-mainborder-light-main-container/10 w-full flex-row items-center justify-evenly">
            <TouchableOpacity
              onPress={() => setActiveActivity("transfers")}
              activeOpacity={0.7}
              className={`px-8 border-b-4 ${activeActivity !== "purchase" ? "border-light-primary-red/75" : "border-light-matte-black/10"} py-2 items-center justify-center grow`}
            >
              <Text
                className={`${activeActivity !== "purchase" ? "text-light-primary-red/75" : "text-light-matte-black/50"} text-center font-bold`}
              >
                Transfers
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveActivity("purchase")}
              activeOpacity={0.7}
              className={`px-8 border-b-4 ${activeActivity === "purchase" ? "border-light-primary-red/75" : "border-light-matte-black/10"} py-2 items-center justify-center grow`}
            >
              <Text
                className={`${activeActivity === "purchase" ? "text-light-primary-red/75" : "text-light-matte-black/50"} text-center font-bold`}
              >
                Purchase
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </SafeAreaView>
    </>
  );
}

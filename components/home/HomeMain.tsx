import React from "react";
import { ScrollView, View } from "react-native";
import ActivitySection from "@/components/home/ActivitySection";
import BalanceSection from "@/components/home/BalanceSection";
import Header from "@/components/home/Header";
import PaymentSection from "@/components/home/PaymentSection";

export default function HomeMain() {
  return (
    <ScrollView
      className="bg-light-main-container flex-1"
      contentContainerStyle={{ gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-1 gap-4 py-4 pb-24">
        <Header />
        <BalanceSection />
        <ActivitySection />
        <PaymentSection />
      </View>
    </ScrollView>
  );
}

import { useLocalSearchParams } from "expo-router";
import React from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ActivityDetailHeader from "@/components/activity-detail/ActivityDetailHeader";
import PurchasedProductCard from "@/components/activity-detail/PurchasedProductCard";
import RenderActivityDetailCards from "@/components/activity-detail/RenderActivityDetailCards";
import { usePurchaseById } from "@/hooks/queries/usePurchases";

export default function ActivityDetailScreen() {
  const { purchaseId, transferId } = useLocalSearchParams<{
    purchaseId: string;
    transferId: string;
  }>();
  const { data: purchase, isLoading, error } = usePurchaseById(purchaseId);
  console.log("Purchase Data:", purchase?.voucherCode);

  const handleSharePress = () => {
    Alert.alert("Share", "Share receipt functionality coming soon!");
  };

  const handleHelpPress = () => {
    Alert.alert("Help", "Need help with this transaction? Contact support.");
  };

  return (
    <SafeAreaView className="flex-1 bg-light-main-container">
      <ActivityDetailHeader
        title="Activity Detail"
        subtitle="Transaction Information"
        onSharePress={handleSharePress}
        onHelpPress={handleHelpPress}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {purchase && (
          <>
            <PurchasedProductCard purchase={purchase} />
            <RenderActivityDetailCards purchase={purchase} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

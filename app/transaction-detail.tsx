import { usePurchaseById } from "@/hooks/queries/usePurchases";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TransactionDetailScreen() {
  const { purchaseId } = useLocalSearchParams();
  const { data: purchase, isLoading, error } = usePurchaseById(purchaseId as string);

  useEffect(() => {
    console.log("Purchase ID:", purchaseId);
  }, [purchaseId]);

  useEffect(() => {
    if (purchase) {
      console.log("Purchase Data:", purchase);
    }
  }, [purchase]);

  useEffect(() => {
    if (error) {
      console.error("Purchase fetch error:", error);
    }
  }, [error]);

  return (
    <SafeAreaView className="flex-1 bg-light-main-container">
      <View className="justify-center items-center flex-1">
        <Text className="text-lg font-medium">Transaction Detail</Text>
        <Text className="text-sm text-gray-600 mt-2">Purchase ID: {purchaseId}</Text>
        {isLoading && <Text className="text-sm text-blue-600 mt-2">Loading purchase data...</Text>}
        {error && <Text className="text-sm text-red-600 mt-2">Error loading purchase</Text>}
        {purchase && <Text className="text-sm text-green-600 mt-2">Purchase data loaded (check console)</Text>}
      </View>
    </SafeAreaView>
  );
}

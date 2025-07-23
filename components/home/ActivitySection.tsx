import { TTransaction } from "@/api/types/transaction";
import { useTransactionSearch } from "@/hooks/queries/useTransactions";
import { useWallet } from "@/hooks/useWallet";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { MoveRight, Send } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function ActivitySection() {
  const { activeWallet } = useWallet();
  const { data: transferHistory } = useTransactionSearch({
    type: "TRANSFER",
    senderAddress: activeWallet?.address,
  });
  const { data: paymentHistory } = useTransactionSearch({
    type: "PAYMENT",
    senderAddress: activeWallet?.address,
  });

  const purchaseHistoryButton = (payment: TTransaction) => (
    <View key={payment.id} className="items-center justify-center">
      <View className="bg-light-primary-red/10 rounded-xl aspect-square w-20 items-center justify-center">
        <Send color="#c71c4b" size={35} />
      </View>
      <Text className="text-light-matte-black text-center text-sm font-bold">
        Product Name
      </Text>
    </View>
  );

  const transferHistoryButton = () => (
    <View className="justify-center items-center">
      <View className="aspect-square w-full max-w-[70px] relative bg-light-primary-red/10 rounded-full items-center justify-center p-3">
        <Text className="text-light-matte-black font-bold text-xs">88 ETH</Text>
        <View className="bg-light-main-container aspect-square w-6 rounded-full absolute bottom-0 right-0 items-center justify-center" />
      </View>
      <Text className="text-light-matte-black text-center text-xs font-bold mt-1">
        0x123...456
      </Text>
    </View>
  );
  return (
    <View className="px-4">
      <View className="bg-light rounded-[14px] w-full p-[22px] gap-4">
        <View className="flex-row">
          <Text className="text-light-matte-black text-sm">Activities</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/activities")}
            className="flex-row items-center justify-center border-2 ml-auto border-light-primary-red bg-light-primary-red/10 gap-2 rounded-full px-4 py-1"
          >
            <Text className="text-light-matte-black text-sm font-bold">
              View All
            </Text>

            <MoveRight size={20} color="#c71c4b" />
          </TouchableOpacity>
        </View>
        <View>
          <FlashList
            data={paymentHistory?.slice(0, 4) || []}
            renderItem={({ item }) => purchaseHistoryButton(item)}
            keyExtractor={(item) => item.id}
            numColumns={4}
            estimatedItemSize={4}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
        </View>
        <View>
          <FlashList
            data={Array.from({ length: 4 }, (_, i) => ({ id: i.toString() }))}
            renderItem={() => transferHistoryButton()}
            keyExtractor={(item) => item.id}
            numColumns={4}
            estimatedItemSize={4}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </View>
    </View>
  );
}

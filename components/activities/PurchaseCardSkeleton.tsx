import React from "react";
import { View } from "react-native";
import SingleLoadingSekeleton from "../common/SingleLoadingSekeleton";

const PurchaseCardSkeleton = React.memo(() => {
  return (
    <View className="bg-white rounded-xl shadow-sm w-full p-5 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <SingleLoadingSekeleton width={34} height={34} borderRadius={8} />
          <View className="gap-1">
            <SingleLoadingSekeleton width={60} height={14} />
            <SingleLoadingSekeleton width={80} height={12} />
          </View>
        </View>
        <SingleLoadingSekeleton width={50} height={20} borderRadius={12} />
      </View>

      <View className="flex-row items-center gap-3">
        <SingleLoadingSekeleton width={48} height={48} borderRadius={8} />
        <View className="flex-1 gap-2">
          <SingleLoadingSekeleton width="80%" height={16} />
          <View className="flex-row items-center gap-2">
            <SingleLoadingSekeleton width="60%" height={12} />
            <SingleLoadingSekeleton width={14} height={14} borderRadius={7} />
            <SingleLoadingSekeleton width={14} height={14} borderRadius={7} />
          </View>
          <View className="flex-row items-center gap-2">
            <SingleLoadingSekeleton width={30} height={12} />
            <SingleLoadingSekeleton width="40%" height={12} />
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between border-t pt-2 border-gray-200">
        <View className="gap-1">
          <SingleLoadingSekeleton width={70} height={12} />
          <SingleLoadingSekeleton width={50} height={14} />
          <SingleLoadingSekeleton width={80} height={16} />
        </View>
        <View className="relative mt-4">
          <SingleLoadingSekeleton width={120} height={20} borderRadius={6} />
          <SingleLoadingSekeleton
            width={80}
            height={28}
            borderRadius={6}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    </View>
  );
});

PurchaseCardSkeleton.displayName = "PurchaseCardSkeleton";

export default PurchaseCardSkeleton;

import React from "react";
import { View } from "react-native";
import SingleLoadingSekeleton from "../common/SingleLoadingSekeleton";

const TransferCardSkeleton = React.memo(() => {
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
        <SingleLoadingSekeleton width={70} height={20} borderRadius={12} />
      </View>

      <View className="gap-1">
        <SingleLoadingSekeleton width={100} height={12} />
        <View className="flex-row items-center gap-2">
          <SingleLoadingSekeleton width="70%" height={12} />
          <SingleLoadingSekeleton width={14} height={14} borderRadius={7} />
          <SingleLoadingSekeleton width={14} height={14} borderRadius={7} />
        </View>
      </View>

      <View className="pt-1 gap-1">
        <SingleLoadingSekeleton width={50} height={12} />
        <SingleLoadingSekeleton width={60} height={16} />
        <SingleLoadingSekeleton width={70} height={14} />
      </View>

      <View className="pt-1 gap-1">
        <SingleLoadingSekeleton width={60} height={12} />
        <SingleLoadingSekeleton width="90%" height={14} />
      </View>

      <View className="pt-1 gap-1">
        <SingleLoadingSekeleton width={50} height={12} />
        <SingleLoadingSekeleton width="90%" height={14} />
      </View>

      <View className="border-t border-gray-200 mt-2 pt-2 gap-1">
        <SingleLoadingSekeleton width={40} height={12} />
        <SingleLoadingSekeleton width="60%" height={14} />
      </View>
    </View>
  );
});

TransferCardSkeleton.displayName = "TransferCardSkeleton";

export default TransferCardSkeleton;

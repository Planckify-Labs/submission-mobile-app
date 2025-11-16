import React, { memo } from "react";
import { View } from "react-native";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";

type DAppCardSkeletonProps = {
  variant?: "default" | "compact" | "grid";
};

const DAppCardSkeleton = memo<DAppCardSkeletonProps>(function DAppCardSkeleton({
  variant = "default",
}) {
  if (variant === "compact") {
    return (
      <View
        className="bg-white rounded-2xl p-4 shadow-sm"
        style={{ width: 160 }}
      >
        <View className="items-center">
          <SingleLoadingSekeleton
            width={56}
            height={56}
            borderRadius={16}
            style={{ marginBottom: 12 }}
          />
          <SingleLoadingSekeleton
            width={100}
            height={14}
            borderRadius={4}
            style={{ marginBottom: 6 }}
          />
          <SingleLoadingSekeleton width={120} height={12} borderRadius={4} />
        </View>
      </View>
    );
  }

  if (variant === "grid") {
    return (
      <View className="bg-white rounded-2xl p-3 shadow-sm mx-1.5 mb-3">
        <View className="flex-row items-center">
          <SingleLoadingSekeleton
            width={44}
            height={44}
            borderRadius={12}
            style={{ marginRight: 10 }}
          />
          <View className="flex-1">
            <SingleLoadingSekeleton
              width={80}
              height={12}
              borderRadius={4}
              style={{ marginBottom: 4 }}
            />
            <SingleLoadingSekeleton width={100} height={10} borderRadius={4} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center">
      <SingleLoadingSekeleton
        width={48}
        height={48}
        borderRadius={12}
        style={{ marginRight: 12 }}
      />
      <View className="flex-1">
        <SingleLoadingSekeleton
          width={120}
          height={16}
          borderRadius={4}
          style={{ marginBottom: 8 }}
        />
        <SingleLoadingSekeleton width={180} height={14} borderRadius={4} />
      </View>
    </View>
  );
});

export default DAppCardSkeleton;

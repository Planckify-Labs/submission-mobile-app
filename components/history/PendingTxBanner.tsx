import React, { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { getPendingTxs, type PendingTx } from "@/services/history/PendingTxTracker";

interface PendingTxBannerProps {
  onPress?: () => void;
}

export function PendingTxBanner({ onPress }: PendingTxBannerProps) {
  const [pending, setPending] = useState<PendingTx[]>([]);

  useEffect(() => {
    const check = () => {
      try {
        setPending(getPendingTxs());
      } catch {
        // DB not ready yet
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (pending.length === 0) return null;

  const oldest = pending[pending.length - 1];
  const ageMs = Date.now() - oldest.submittedAt;
  const ageMinutes = Math.floor(ageMs / 60000);
  const ageText =
    ageMinutes < 1
      ? "just now"
      : ageMinutes === 1
        ? "1 min ago"
        : `${ageMinutes} min ago`;

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse" />
          <Text className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {pending.length} pending transaction{pending.length > 1 ? "s" : ""}
          </Text>
        </View>
        <Text className="text-xs text-yellow-600 dark:text-yellow-400">
          {ageText}
        </Text>
      </View>
    </Pressable>
  );
}

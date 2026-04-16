import React from "react";
import { Pressable, Text, View } from "react-native";
import type { PendingTx } from "@/services/history/PendingTxTracker";
import {
  buildCancelParams,
  buildSpeedUpParams,
} from "@/services/history/PendingTxTracker";

interface SpeedUpSheetProps {
  tx: PendingTx;
  onSpeedUp: (params: ReturnType<typeof buildSpeedUpParams>) => void;
  onCancel: (params: ReturnType<typeof buildCancelParams>) => void;
  onDismiss: () => void;
}

export function SpeedUpSheet({
  tx,
  onSpeedUp,
  onCancel,
  onDismiss,
}: SpeedUpSheetProps) {
  const ageMs = Date.now() - tx.submittedAt;
  const ageMinutes = Math.floor(ageMs / 60000);

  return (
    <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6">
      {/* Header */}
      <View className="items-center mb-6">
        <View className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mb-4" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white">
          Transaction Stuck
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pending for {ageMinutes < 1 ? "< 1" : ageMinutes} minute
          {ageMinutes !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Context */}
      {tx.description && (
        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <Text className="text-sm text-gray-700 dark:text-gray-300">
            {tx.description}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Nonce: {tx.nonce}
          </Text>
        </View>
      )}

      {/* Speed Up */}
      <Pressable
        onPress={() => onSpeedUp(buildSpeedUpParams(tx))}
        className="bg-blue-600 rounded-xl py-4 mb-3 items-center"
      >
        <Text className="text-white font-semibold text-base">
          Speed Up (+20% gas)
        </Text>
        <Text className="text-blue-200 text-xs mt-0.5">
          Resubmits the same transaction with higher gas
        </Text>
      </Pressable>

      {/* Cancel */}
      <Pressable
        onPress={() => onCancel(buildCancelParams(tx))}
        className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl py-4 mb-3 items-center"
      >
        <Text className="text-red-600 dark:text-red-400 font-semibold text-base">
          Cancel Transaction
        </Text>
        <Text className="text-red-400 dark:text-red-500 text-xs mt-0.5">
          Sends a zero-value self-transfer to replace this tx
        </Text>
      </Pressable>

      {/* Dismiss */}
      <Pressable onPress={onDismiss} className="py-3 items-center">
        <Text className="text-gray-500 dark:text-gray-400 font-medium">
          Keep Waiting
        </Text>
      </Pressable>
    </View>
  );
}

import React from "react";
import { View, Text, Pressable } from "react-native";
import { formatEther } from "viem";
import type { WalletTransaction, TxType, TxStatus } from "@/services/indexer/types";

interface TransactionRowProps {
  tx: WalletTransaction;
  userAddress: string;
  onPress?: (tx: WalletTransaction) => void;
}

const TYPE_ICONS: Record<TxType, string> = {
  "native-transfer": "\u2191\u2193",
  "token-transfer": "\u2191\u2193",
  "token-approve": "\u2713",
  "nft-transfer": "\u25A0",
  swap: "\u21C4",
  "contract-interaction": "\u2699",
  "contract-deploy": "\u271A",
  bridge: "\u2194",
  unknown: "?",
};

const STATUS_COLORS: Record<TxStatus, string> = {
  confirmed: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  pending: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
  failed: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
  dropped: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  replaced: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
};

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatValue(value: bigint): string {
  if (value === 0n) return "0";
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(4);
  return num.toFixed(4);
}

function getTypeLabel(type: TxType): string {
  const labels: Record<TxType, string> = {
    "native-transfer": "Transfer",
    "token-transfer": "Token Transfer",
    "token-approve": "Approval",
    "nft-transfer": "NFT Transfer",
    swap: "Swap",
    "contract-interaction": "Contract",
    "contract-deploy": "Deploy",
    bridge: "Bridge",
    unknown: "Transaction",
  };
  return labels[type];
}

export function TransactionRow({ tx, userAddress, onPress }: TransactionRowProps) {
  const isSent = tx.from.toLowerCase() === userAddress.toLowerCase();
  const counterparty = isSent ? tx.to : tx.from;
  const icon = TYPE_ICONS[tx.type];
  const statusClass = STATUS_COLORS[tx.status];
  const time = tx.timestamp
    ? new Date(tx.timestamp * 1000).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Pressable
      onPress={() => onPress?.(tx)}
      className="flex-row items-center px-4 py-3 bg-white dark:bg-gray-900"
    >
      {/* Icon */}
      <View className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mr-3">
        <Text className="text-lg">{icon}</Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="text-base font-medium text-gray-900 dark:text-white mr-2">
            {getTypeLabel(tx.type)}
          </Text>
          {tx.status !== "confirmed" && (
            <View className={`px-1.5 py-0.5 rounded ${statusClass.split(" ").filter(c => c.startsWith("bg-")).join(" ")}`}>
              <Text className={`text-xs font-medium ${statusClass.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                {tx.status}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {isSent ? "To: " : "From: "}
          {counterparty ? truncateAddress(counterparty) : "Contract"}
        </Text>
      </View>

      {/* Value + time */}
      <View className="items-end">
        {tx.value > 0n && (
          <Text
            className={`text-base font-medium ${
              isSent
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            {isSent ? "-" : "+"}
            {formatValue(tx.value)}
          </Text>
        )}
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {time}
        </Text>
      </View>
    </Pressable>
  );
}

import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { formatUnits } from "viem";
import type { TokenBalanceItem } from "@/services/tokens/types";
import { SpamBadge } from "./SpamBadge";

interface TokenRowProps {
  token: TokenBalanceItem;
  onPress?: (token: TokenBalanceItem) => void;
}

export function TokenRow({ token, onPress }: TokenRowProps) {
  const balance = parseFloat(formatUnits(token.balance, token.decimals));
  const usdValue = balance * (token.price ?? 0);
  const change = token.change24h ?? 0;
  const isPositive = change >= 0;

  const formatBalance = (val: number) => {
    if (val === 0) return "0";
    if (val < 0.0001) return "<0.0001";
    if (val < 1) return val.toFixed(4);
    if (val < 1000) return val.toFixed(2);
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatUsd = (val: number) => {
    if (val < 0.01) return "$0.00";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Pressable
      onPress={() => onPress?.(token)}
      className="flex-row items-center px-4 py-3 bg-white dark:bg-gray-900"
    >
      {/* Token logo */}
      <View className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center mr-3">
        {token.logoURI ? (
          <Image
            source={{ uri: token.logoURI }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <Text className="text-gray-500 dark:text-gray-400 font-bold text-sm">
            {token.symbol.slice(0, 2)}
          </Text>
        )}
      </View>

      {/* Token info */}
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {token.symbol}
          </Text>
          {(token.isSpam || token.spamReason) && (
            <SpamBadge
              severity={token.isSpam ? "danger" : "warn"}
              reason={token.spamReason}
            />
          )}
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {token.name}
        </Text>
      </View>

      {/* Balance + value */}
      <View className="items-end">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {formatBalance(balance)}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400 mr-1">
            {formatUsd(usdValue)}
          </Text>
          {token.price != null && change !== 0 && (
            <Text
              className={`text-xs font-medium ${
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {change.toFixed(1)}%
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

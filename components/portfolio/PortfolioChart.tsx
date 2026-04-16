import React from "react";
import { Text, View } from "react-native";
import type { PortfolioSummary } from "@/services/tokens/prices";

interface PortfolioChartProps {
  summary: PortfolioSummary;
}

export function PortfolioChart({ summary }: PortfolioChartProps) {
  const isPositive = summary.change24hPercent >= 0;
  const currencySymbol = CURRENCY_SYMBOLS[summary.currency] ?? "$";

  const formatValue = (val: number) => {
    if (val < 1) return `${currencySymbol}0.00`;
    return `${currencySymbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <View className="px-4 py-6 items-center">
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
        Portfolio Value
      </Text>
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {formatValue(summary.totalValueLocal)}
      </Text>
      <View className="flex-row items-center">
        <Text
          className={`text-base font-medium ${
            isPositive
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {summary.change24hPercent.toFixed(2)}%
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
          24h
        </Text>
      </View>
    </View>
  );
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
  JPY: "\u00A5",
  IDR: "Rp",
  KRW: "\u20A9",
  CNY: "\u00A5",
};

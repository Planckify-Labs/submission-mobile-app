import React from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { formatEther, formatGwei, formatUnits } from "viem";
import type { WalletTransaction } from "@/services/indexer/types";

interface TransactionDetailProps {
  tx: WalletTransaction;
  onClose?: () => void;
}

function getExplorerUrl(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    137: "https://polygonscan.com",
    56: "https://bscscan.com",
    42161: "https://arbiscan.io",
    10: "https://optimistic.etherscan.io",
    8453: "https://basescan.org",
    5: "https://goerli.etherscan.io",
  };
  const base = explorers[chainId] ?? "https://etherscan.io";
  return `${base}/tx/${hash}`;
}

function formatGasFee(gasUsed?: bigint, gasPrice?: bigint): string {
  if (!gasUsed || !gasPrice) return "N/A";
  return `${formatEther(gasUsed * gasPrice)} ETH`;
}

export function TransactionDetail({ tx, onClose }: TransactionDetailProps) {
  const explorerUrl = getExplorerUrl(tx.chainId, tx.hash);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <View className="mb-6">
        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          Transaction Details
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
        </Text>
      </View>

      {/* Status */}
      <DetailRow label="Status" value={tx.status} />
      <DetailRow label="Type" value={tx.type} />
      <DetailRow label="From" value={tx.from} truncate />
      {tx.to && <DetailRow label="To" value={tx.to} truncate />}
      <DetailRow
        label="Value"
        value={formatEther(tx.value)}
      />
      <DetailRow label="Nonce" value={String(tx.nonce)} />
      {tx.blockNumber && (
        <DetailRow label="Block" value={String(tx.blockNumber)} />
      )}
      {tx.timestamp && (
        <DetailRow
          label="Time"
          value={new Date(tx.timestamp * 1000).toLocaleString()}
        />
      )}

      {/* Gas breakdown */}
      <View className="mt-4 mb-2">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Gas Details
        </Text>
      </View>
      <DetailRow
        label="Gas Used"
        value={tx.fee.gasUsed ? tx.fee.gasUsed.toString() : "N/A"}
      />
      <DetailRow
        label="Gas Price"
        value={
          tx.fee.effectiveGasPrice
            ? `${formatGwei(tx.fee.effectiveGasPrice)} Gwei`
            : "N/A"
        }
      />
      <DetailRow
        label="Total Fee"
        value={formatGasFee(tx.fee.gasUsed, tx.fee.effectiveGasPrice)}
      />
      {tx.fee.feeUsd != null && (
        <DetailRow label="Fee (USD)" value={`$${tx.fee.feeUsd.toFixed(2)}`} />
      )}

      {/* Token transfers */}
      {tx.decoded.tokenTransfers.length > 0 && (
        <View className="mt-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Token Transfers
          </Text>
          {tx.decoded.tokenTransfers.map((t, i) => (
            <View key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-2">
              <Text className="text-sm text-gray-900 dark:text-white">
                {t.symbol ?? "Token"}: {formatUnits(t.value, t.decimals ?? 18)}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {t.from.slice(0, 8)}... → {t.to.slice(0, 8)}...
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Explorer link */}
      <Pressable
        onPress={() => Linking.openURL(explorerUrl)}
        className="mt-6 mb-8 bg-blue-600 rounded-xl py-3 items-center"
      >
        <Text className="text-white font-semibold">View on Block Explorer</Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  const display = truncate && value.length > 16
    ? `${value.slice(0, 8)}...${value.slice(-6)}`
    : value;

  return (
    <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-800">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        {display}
      </Text>
    </View>
  );
}

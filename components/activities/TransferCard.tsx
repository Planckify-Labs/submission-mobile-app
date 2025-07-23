import { TTransaction } from "@/api/types/transaction";
import * as ExpoClipboard from "expo-clipboard";
import { openBrowserAsync } from "expo-web-browser";
import { Copy, ExternalLink, Send } from "lucide-react-native";
import React, { useCallback } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import Chip from "../common/Chip";

const TransferCard = React.memo(
  ({ transaction }: { transaction: TTransaction }) => {
    const transactionHash = "0xabcdef1234567890";
    const recipient = "0xrecipientAddress0987";
    const spender = "0xspenderAddress1234";
    const blockchain = "Ethereum Mainnet";

    const copyToClipboard = useCallback((label: string, value: string) => {
      ExpoClipboard.setStringAsync(value);
      Alert.alert("Copied!", `${label} copied to clipboard.`);
    }, []);

    const openBlockExplorer = useCallback(() => {
      openBrowserAsync(`https://etherscan.io/tx/${transactionHash}`);
    }, [transactionHash]);

    return (
      <View className="bg-white rounded-xl shadow-sm w-full p-5 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="bg-light-main-container p-2 rounded-md">
              <Send size={18} stroke="#c71c4b" />
            </View>
            <View>
              <Text className="text-light-matte-black font-medium text-sm">
                Transfer
              </Text>
              <Text className="text-light-matte-black/50 text-xs">
                22 Jun 2025
              </Text>
            </View>
          </View>
          <View className="h-full">
            <Chip label="Confirmed" size="small" />
          </View>
        </View>

        <View className="gap-1">
          <Text className="text-light-matte-black text-xs">
            Transaction Hash
          </Text>
          <View className="flex-row items-center gap-2">
            <Text
              className="text-light-matte-black/50 text-xs flex-1"
              numberOfLines={1}
            >
              {transactionHash}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                copyToClipboard("Transaction hash", transactionHash)
              }
            >
              <Copy size={14} color="#c71c4b" />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={openBlockExplorer}>
              <ExternalLink size={14} color="#c71c4b" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="pt-1">
          <Text className="text-light-matte-black text-xs">Amount</Text>
          <Text className="text-light-primary-red font-bold text-md">
            0.42 ETH
          </Text>
          <Text className="text-light-matte-black text-sm">Rp.61,000</Text>
        </View>

        <View className="pt-1">
          <Text className="text-light-matte-black text-xs">Recipient</Text>
          <Text className="text-light-matte-black/80 text-sm" numberOfLines={1}>
            {recipient}
          </Text>
        </View>

        <View className="pt-1">
          <Text className="text-light-matte-black text-xs">Spender</Text>
          <Text className="text-light-matte-black/80 text-sm" numberOfLines={1}>
            {spender}
          </Text>
        </View>

        <View className="border-t border-gray-200 mt-2 pt-2">
          <Text className="text-light-matte-black text-xs">Chain</Text>
          <Text className="text-light-matte-black text-sm">{blockchain}</Text>
        </View>
      </View>
    );
  },
);

TransferCard.displayName = "TransferCard";

export default TransferCard;

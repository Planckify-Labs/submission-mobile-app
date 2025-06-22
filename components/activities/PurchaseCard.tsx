import * as ExpoClipboard from "expo-clipboard";
import { openBrowserAsync } from "expo-web-browser";
import { Copy, ExternalLink, ShoppingBag } from "lucide-react-native";
import React from "react";
import {
  Alert,
  Image,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Chip from "../common/Chip";

export default function PurchaseCard() {
  const itemImage = "https://via.placeholder.com/60";
  const transactionHash = "0x1234abcd5678efgh9012ijkl";
  const blockchain = "Ethereum Mainnet";

  const copyToClipboard = () => {
    ExpoClipboard.setStringAsync(transactionHash);
    Alert.alert("Copied!", "Transaction hash copied to clipboard.");
  };

  const openBlockExplorer = () => {
    openBrowserAsync(`https://etherscan.io/tx/${transactionHash}`);
  };

  return (
    <View className="bg-white rounded-xl shadow-sm w-full p-5 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="bg-light-main-container p-2 rounded-md">
            <ShoppingBag size={18} stroke="#c71c4b" />
          </View>
          <View>
            <Text className="text-light-matte-black font-medium text-sm">
              Purchase
            </Text>
            <Text className="text-light-matte-black/50 text-xs">
              28 Apr 2025
            </Text>
          </View>
        </View>
        <View className="h-full">
          <Chip label="Finish" size="small" />
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <Image
          source={{ uri: itemImage }}
          className="w-12 h-12 rounded-md bg-light-main-container"
        />
        <View className="flex-1">
          <Text
            className="text-black font-semibold"
            ellipsizeMode="tail"
            numberOfLines={1}
          >
            Nasi Uduk Betawi
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Text
              className="text-light-matte-black/50 text-xs flex-1"
              numberOfLines={1}
            >
              {transactionHash}
            </Text>
            <TouchableOpacity onPress={copyToClipboard}>
              <Copy size={14} color="#c71c4b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={openBlockExplorer}>
              <ExternalLink size={14} color="#c71c4b" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-2">
            <Text className="text-light-matte-black/50 text-xs">Chain:</Text>
            <Text className="text-light-matte-black text-xs">{blockchain}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between border-t pt-2 border-gray-200">
        <View>
          <Text className="text-light-matte-black text-xs">Total Amount</Text>
          <Text className="text-light-matte-black text-sm">0.67 ETH</Text>
          <Text className="text-light-primary-red font-bold text-md">
            Rp.98,900
          </Text>
        </View>
        <View className="relative mt-4">
          <Text className="text-light-primary-red bg-light-primary-red/10 font-bold text-center pb-2 border border-light-primary-red text-xs absolute -top-3 right-0 left-0 rounded-md p-2">
            Discount Rp.70,000
          </Text>
          <Pressable className="bg-light-primary-red px-8 py-2 rounded-md mt-3">
            <Text className="text-white text-xs font-bold">Repurchase</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

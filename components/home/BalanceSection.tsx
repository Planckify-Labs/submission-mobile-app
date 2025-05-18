import ChainSelector from "@/components/wallet/ChainSelector";
import { useWallet } from "@/hooks/useWallet";
import { copyToClipboard } from "@/utils/authUtils";
import {
  ArrowBigDown,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  PlusIcon,
  Wallet,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  Vibration,
  View,
} from "react-native";

export default function BalanceSection() {
  const { activeWallet, activeChain, isLoading } = useWallet();
  const [isShowBalance, setShowBalance] = useState(true);
  const [selectedToken, setSelectedToken] = useState(
    activeChain?.nativeCurrency?.symbol || "ETH",
  );

  if (isLoading) {
    return (
      <View className="bg-light rounded-2xl w-full p-6 items-center justify-center shadow-sm">
        <ActivityIndicator size="small" color="#c71c4b" />
        <Text className="text-light-matte-black mt-2">Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View className="bg-light rounded-2xl w-full p-5 shadow-sm">
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center">
          <View className="bg-light-primary-red/10 p-2 rounded-full mr-2">
            <Wallet size={18} color="#c71c4b" />
          </View>
          <Text className="font-bold text-light-matte-black text-base">
            TakumiPay
          </Text>
        </View>

        <ChainSelector />
      </View>

      <View className="flex-row items-center mb-3">
        <Text className="text-light-matte-black/70 text-xs mr-2">
          {activeWallet.name || "Wallet"}
        </Text>
        <Pressable
          onPress={() => copyToClipboard(activeWallet.address, "Address")}
          className="flex-row items-center ml-auto gap-2"
        >
          <Text className="text-light-matte-black/60 text-xs">
            {activeWallet.address.substring(0, 6)}...
            {activeWallet.address.substring(activeWallet.address.length - 4)}
          </Text>
          <Copy size={12} color="#c71c4b" className="ml-1" />
        </Pressable>
      </View>

      <View className="bg-light-main-container/50 p-4 rounded-xl mb-6">
        <View className="flex-row items-center justify-between mb-1">
          <Pressable
            onPress={() => setSelectedToken(activeChain.nativeCurrency.symbol)}
            className="flex-row items-center"
          >
            <Text className="text-light-matte-black font-medium text-sm mr-1">
              {selectedToken}
            </Text>
            <ChevronDown size={14} color="#c71c4b" />
          </Pressable>

          <Pressable
            onPress={() => {
              Vibration.vibrate(100);
              setShowBalance((prevValue) => !prevValue);
            }}
          >
            {isShowBalance ? (
              <Eye size={16} color="#c71c4b" />
            ) : (
              <EyeOff size={16} color="#c71c4b" />
            )}
          </Pressable>
        </View>

        <View>
          {isShowBalance ? (
            <Text className="text-light-primary-red font-bold text-4xl">
              {activeWallet.balance}
            </Text>
          ) : (
            <View className="flex-row items-center gap-2 py-2">
              <View className="h-2 bg-light-primary-red w-16 rounded-full" />
              <View className="h-2 bg-light-primary-red w-10 rounded-full" />
              <View className="h-2 bg-light-primary-red w-8 rounded-full" />
            </View>
          )}
        </View>
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1 gap-3 flex-row grow">
          <Pressable className="grow bg-light-main-container rounded-xl py-3 px-3 flex-row items-center">
            <View className="bg-light-primary-red/10 rounded-full p-1.5 mr-2">
              <PlusIcon size={20} color="#c71c4b" />
            </View>
            <Text className="text-light-matte-black text-sm font-medium">
              Top Up
            </Text>
          </Pressable>

          <Pressable className="grow bg-light-main-container rounded-xl py-3 px-3 flex-row items-center">
            <View className="bg-light-primary-red/10 rounded-full p-1.5 mr-2">
              <ArrowBigDown size={20} color="#c71c4b" />
            </View>
            <Text className="text-light-matte-black text-sm font-medium">
              Withdraw
            </Text>
          </Pressable>
        </View>

        <View className="flex-row gap-3">
          <View className="items-center">
            <Pressable className="bg-light-matte-black rounded-full items-center justify-center w-12 h-12 mb-1">
              <ArrowDownToLine size={20} color="#fff" />
            </Pressable>
            <Text className="text-xs text-light-matte-black font-medium">
              Receive
            </Text>
          </View>

          <View className="items-center">
            <Pressable className="bg-light-matte-black rounded-full items-center justify-center w-12 h-12 mb-1">
              <ArrowUpToLine size={20} color="#fff" />
            </Pressable>
            <Text className="text-xs text-light-matte-black font-medium">
              Send
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

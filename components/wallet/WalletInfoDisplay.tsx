import { TWallet } from "@/hooks/useWallet";
import { Copy, Eye, EyeOff } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";

type WalletInfoDisplayProps = {
  wallet: TWallet;
  showWalletInfo: boolean;
  onToggleVisibility: () => void;
  onCopy: (text: string, label: string) => void;
};

export default memo(function WalletInfoDisplay({
  wallet,
  showWalletInfo,
  onToggleVisibility,
  onCopy,
}: WalletInfoDisplayProps) {
  if (!wallet || !wallet.type) return null;

  switch (wallet.type) {
    case "SeedPhrase":
      return (
        <View className="mb-4">
          <Text className="text-light-matte-black/70 mb-1">Seed Phrase</Text>
          <View className="bg-light-main-container p-4 rounded-xl">
            <Text className="text-light-matte-black mb-2">
              {showWalletInfo && wallet.seedPhrase
                ? wallet.seedPhrase
                : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"}
            </Text>
            <View className="flex-row justify-end">
              <Pressable onPress={onToggleVisibility} className="mr-3">
                {showWalletInfo ? (
                  <EyeOff size={20} color="#c71c4b" />
                ) : (
                  <Eye size={20} color="#c71c4b" />
                )}
              </Pressable>
              {showWalletInfo && wallet.seedPhrase && (
                <Pressable
                  onPress={() => onCopy(wallet.seedPhrase || "", "Seed Phrase")}
                >
                  <Copy size={20} color="#c71c4b" />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      );

    case "PrivateKey":
      return (
        <View className="mb-4">
          <Text className="text-light-matte-black/70 mb-1">Private Key</Text>
          <View className="bg-light-main-container p-4 rounded-xl">
            <Text className="text-light-matte-black mb-2">
              {showWalletInfo && wallet.privateKey
                ? wallet.privateKey
                : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
            </Text>
            <View className="flex-row justify-end">
              <Pressable onPress={onToggleVisibility} className="mr-3">
                {showWalletInfo ? (
                  <EyeOff size={20} color="#c71c4b" />
                ) : (
                  <Eye size={20} color="#c71c4b" />
                )}
              </Pressable>
              {showWalletInfo && wallet.privateKey && (
                <Pressable
                  onPress={() => onCopy(wallet.privateKey || "", "Private Key")}
                >
                  <Copy size={20} color="#c71c4b" />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      );

    case "Social":
      return (
        <View className="mb-4">
          <Text className="text-light-matte-black/70 mb-1">Social Account</Text>
          <View className="bg-light-main-container p-4 rounded-xl">
            <Text className="text-light-matte-black mb-1">
              Provider: {wallet.socialAccount?.provider || "Unknown"}
            </Text>
            <Text className="text-light-matte-black mb-1">
              Email: {wallet.socialAccount?.email || "Not available"}
            </Text>
            <Text className="text-light-matte-black">
              Name: {wallet.socialAccount?.name || "Not available"}
            </Text>
          </View>
        </View>
      );

    default:
      return null;
  }
});

import { isValidMnemonic } from "@/utils/walletUtils";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WalletImport from "./WalletImport";

export default function ImportSeedPhrase() {
  return (
    <SafeAreaView className="flex-1 bg-light-main-container">
      <ScrollView className="flex-1 p-4">
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ArrowLeft color="#000" size={24} />
          </Pressable>
          <Text className="text-light-matte-black text-xl font-bold">
            Import with Seed Phrase
          </Text>
        </View>

        <View className="bg-light-primary-red/10 p-4 rounded-xl mb-6">
          <Text className="text-light-matte-black">
            Your seed phrase is a 12 or 24-word phrase that gives you access to
            your wallet. Never share it with anyone and keep it secure.
          </Text>
        </View>

        <WalletImport
          type="SeedPhrase"
          title="Enter your seed phrase"
          placeholder="Enter your 12 or 24-word seed phrase, with spaces between each word"
          validationMessage="Please enter a valid 12 or 24-word seed phrase"
          validateInput={isValidMnemonic}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

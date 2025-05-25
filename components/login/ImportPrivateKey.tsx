import { isValidPrivateKey } from "@/utils/walletUtils";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WalletImport from "./WalletImport";

export default function ImportPrivateKey() {
  return (
    <SafeAreaView className="flex-1 bg-light-main-container">
      <ScrollView className="flex-1 p-4">
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ArrowLeft color="#000" size={24} />
          </Pressable>
          <Text className="text-light-matte-black text-xl font-bold">
            Import with Private Key
          </Text>
        </View>

        <View className="bg-light-primary-red/10 p-4 rounded-xl mb-6">
          <Text className="text-light-matte-black">
            Your private key is a sensitive piece of information. Never share it
            with anyone and keep it secure.
          </Text>
        </View>

        <WalletImport
          type="PrivateKey"
          title="Enter your private key"
          placeholder="Enter your private key"
          validationMessage="Please enter a valid private key"
          validateInput={isValidPrivateKey}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

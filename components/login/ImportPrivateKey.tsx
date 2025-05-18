import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import {
  ArrowLeft,
  Clipboard as ClipboardIcon,
  Eye,
  EyeOff,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ImportPrivateKey() {
  const [privateKey, setPrivateKey] = useState<string>("");
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();

      const privateKeyRegex = /^(0x)?[0-9a-fA-F]{64}$/;
      if (!privateKeyRegex.test(text)) {
        Alert.alert("Invalid Private Key", "Please paste a valid private key");
        return;
      }

      setPrivateKey(text);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to paste from clipboard");
    }
  };

  const handleImport = () => {
    const privateKeyRegex = /^(0x)?[0-9a-fA-F]{64}$/;
    if (!privateKeyRegex.test(privateKey)) {
      Alert.alert("Invalid Private Key", "Please enter a valid private key");
      return;
    }

    Alert.alert("Success", "Wallet imported successfully", [
      { text: "OK", onPress: () => router.replace("/") },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
      <ScrollView className="flex-1 p-6">
        <Pressable onPress={() => router.back()} className="mb-6">
          <ArrowLeft color="#c71c4b" size={24} />
        </Pressable>

        <Text className="text-light-matte-black text-3xl font-bold mb-6">
          Import with Private Key
        </Text>

        <View className="bg-light rounded-xl p-5 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-light-matte-black font-medium">
              Enter your private key
            </Text>
            <Pressable
              className="flex-row items-center bg-light-primary-red/10 px-3 py-2 rounded-lg"
              onPress={handlePasteFromClipboard}
            >
              <ClipboardIcon size={16} color="#c71c4b" className="mr-2" />
              <Text className="text-light-primary-red font-medium">Paste</Text>
            </Pressable>
          </View>

          <View className="relative mb-4">
            <TextInput
              className="bg-light-main-container p-4 pr-12 rounded-xl text-light-matte-black border border-light-matte-black/10"
              placeholder="Enter your private key"
              value={privateKey}
              onChangeText={setPrivateKey}
              secureTextEntry={!showPrivateKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              className="absolute right-3 top-4"
              onPress={() => setShowPrivateKey(!showPrivateKey)}
            >
              {showPrivateKey ? (
                <EyeOff size={20} color="#c71c4b" />
              ) : (
                <Eye size={20} color="#c71c4b" />
              )}
            </Pressable>
          </View>

          <View className="bg-light-primary-red/10 p-4 rounded-xl mb-4">
            <Text className="text-light-matte-black">
              Your private key is a sensitive piece of information. Never share
              it with anyone and keep it secure.
            </Text>
          </View>
        </View>

        <Pressable
          className="bg-light-primary-red py-4 rounded-full items-center"
          onPress={handleImport}
        >
          <Text className="text-light font-bold text-lg">Import Wallet</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

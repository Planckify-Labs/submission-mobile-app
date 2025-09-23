import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useWallet } from "@/hooks/useWallet";

interface WalletImportProps {
  type: "SeedPhrase" | "PrivateKey";
  title: string;
  placeholder: string;
  validationMessage: string;
  validateInput: (input: string) => boolean;
}

export default function WalletImport({
  type,
  title,
  placeholder,
  validationMessage,
  validateInput,
}: WalletImportProps) {
  const [input, setInput] = useState<string>("");
  const [walletName, setWalletName] = useState<string>("");
  const { addWallet } = useWallet();

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();

      if (!validateInput(text)) {
        Alert.alert("Invalid Input", validationMessage);
        return;
      }

      setInput(text);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to paste from clipboard");
    }
  };

  const handleImport = () => {
    if (!validateInput(input)) {
      Alert.alert("Invalid Input", validationMessage);
      return;
    }

    addWallet({
      source: type,
      [type === "SeedPhrase" ? "seedPhrase" : "privateKey"]: input,
      name: walletName || undefined,
    }).then((success) => {
      if (success) {
        Alert.alert("Success", "Wallet imported successfully", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      } else {
        Alert.alert("Error", "Failed to import wallet");
      }
    });
  };

  return (
    <View>
      <Text className="text-light-matte-black font-medium mb-2">{title}</Text>
      <TextInput
        className="bg-light p-3 rounded-lg text-light-matte-black border border-light-matte-black/10 mb-4"
        value={input}
        onChangeText={setInput}
        placeholder={placeholder}
        multiline={type === "SeedPhrase"}
        numberOfLines={type === "SeedPhrase" ? 4 : 1}
        secureTextEntry={type === "PrivateKey"}
      />

      <Pressable
        className="bg-light-primary-red/10 px-3 py-2 rounded-lg self-start mb-4"
        onPress={handlePasteFromClipboard}
      >
        <Text className="text-light-primary-red font-medium">
          Paste from Clipboard
        </Text>
      </Pressable>

      <Text className="text-light-matte-black font-medium mb-2">
        Wallet Name (Optional)
      </Text>
      <TextInput
        className="bg-light p-3 rounded-lg text-light-matte-black border border-light-matte-black/10 mb-6"
        value={walletName}
        onChangeText={setWalletName}
        placeholder="Enter a name for this wallet"
      />

      <Pressable
        className="bg-light-primary-red py-4 rounded-full items-center"
        onPress={handleImport}
      >
        <Text className="text-light font-bold text-lg">Import Wallet</Text>
      </Pressable>
    </View>
  );
}

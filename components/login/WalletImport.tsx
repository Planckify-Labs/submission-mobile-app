import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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
        console.error("Invalid Input:", validationMessage);
        return;
      }

      setInput(text);
    } catch (error) {
      console.error(error);
      console.error("Error: Failed to paste from clipboard");
    }
  };

  const handleImport = () => {
    if (!validateInput(input)) {
      console.error("Invalid Input:", validationMessage);
      return;
    }

    addWallet({
      source: type,
      [type === "SeedPhrase" ? "seedPhrase" : "privateKey"]: input,
      name: walletName || undefined,
    }).then((success) => {
      if (success) {
        console.log("Success: Wallet imported successfully");
        router.replace("/");
      } else {
        console.error("Error: Failed to import wallet");
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

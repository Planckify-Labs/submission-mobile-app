import * as Clipboard from "expo-clipboard";
import { Copy, Plus } from "lucide-react-native";
import React from "react";
import { Alert, Pressable, Text, View } from "react-native";

type SeedPhraseGridProps = {
  mnemonic: string[];
  showCopyButton?: boolean;
  editable?: boolean;
  onWordPress?: (index: number) => void;
};

export default function SeedPhraseGrid({
  mnemonic,
  showCopyButton = true,
  editable = false,
  onWordPress,
}: SeedPhraseGridProps) {
  return (
    <View className="mb-6">
      <View
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {mnemonic.map((word, index) => (
          <Pressable
            key={index}
            className="bg-light"
            style={{
              borderRadius: 12,
              padding: 16,
              width: "30%",
              alignItems: "center",
              marginBottom: 16,
              borderWidth: editable ? 1 : 0,
              borderColor: "rgba(0,0,0,0.1)",
            }}
            onPress={() => editable && onWordPress && onWordPress(index)}
          >
            <View className="w-8 h-8 aspect-square rounded-full bg-light-primary-red/10 items-center justify-center mb-2">
              <Text className="text-light-primary-red font-bold">
                {index + 1}
              </Text>
            </View>
            {word ? (
              <Text className="font-bold">{word}</Text>
            ) : editable ? (
              <View className="items-center justify-center">
                <Plus size={16} color="#c71c4b" />
              </View>
            ) : (
              <Text className="font-bold">•••••</Text>
            )}
          </Pressable>
        ))}
      </View>

      {showCopyButton && (
        <Pressable
          className="flex-row items-center justify-center mb-5 bg-light gap-2 p-4 rounded-xl"
          onPress={() => {
            Clipboard.setStringAsync(mnemonic.join(" "));
            Alert.alert("Copied", "Secret phrase copied to clipboard");
          }}
        >
          <Copy size={18} color="#c71c4b" className="mr-2" />
          <Text className="text-light-matte-black font-bold">
            Copy Seed Phrase
          </Text>
        </Pressable>
      )}
    </View>
  );
}

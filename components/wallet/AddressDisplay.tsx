import { Copy } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

type AddressDisplayProps = {
  address: string;
  onCopy: () => void;
};

export default function AddressDisplay({
  address,
  onCopy,
}: AddressDisplayProps) {
  return (
    <View className="mb-4">
      <Text className="text-light-matte-black/70 mb-1">Wallet Address</Text>
      <View className="bg-light-main-container/50 p-3 rounded-xl mb-3 flex-row items-center">
        <Text
          className="text-light-matte-black/80 flex-1 text-sm"
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {address}
        </Text>
        <Pressable
          onPress={onCopy}
          className="ml-2 p-2"
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Copy size={16} color="#c71c4b" />
        </Pressable>
      </View>
    </View>
  );
}

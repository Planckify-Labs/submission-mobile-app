import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TAddTokenFormProps } from "@/constants/types/assetTypes";

const AddTokenForm = ({
  state,
  onAddressChange,
  onSubmit,
}: TAddTokenFormProps) => {
  const { tokenAddress, isLoading } = state;
  return (
    <View className="bg-light rounded-xl p-4 mb-4 shadow-sm">
      <Text className="text-light-matte-black font-bold mb-3">
        Add Custom Token
      </Text>
      <TextInput
        className="bg-light-main-container rounded-xl p-3 mb-3 text-light-matte-black"
        placeholder="Enter token contract address"
        value={tokenAddress}
        onChangeText={onAddressChange}
      />
      <Pressable
        onPress={onSubmit}
        disabled={isLoading}
        className="bg-light-primary-red rounded-xl py-3 items-center"
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text className="text-white font-bold">Add Token</Text>
        )}
      </Pressable>
    </View>
  );
};

export default AddTokenForm;

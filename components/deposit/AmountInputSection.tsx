import React, { memo } from "react";
import { Text, TextInput, View } from "react-native";

interface AmountInputSectionProps {
  amount: string;
  tokenSymbol: string;
  onAmountChange: (value: string) => void;
}

export const AmountInputSection = memo<AmountInputSectionProps>(
  ({ amount, tokenSymbol, onAmountChange }) => {
    return (
      <View className="mb-4 px-5">
        <Text className="text-light-matte-black/70 mb-2">Points</Text>
        <View className="flex-row items-center">
          <TextInput
            className="bg-light-main-container p-4 rounded-xl text-light-matte-black flex-1 text-lg font-semibold"
            value={amount}
            onChangeText={onAmountChange}
            placeholder="0"
            placeholderTextColor="#20222c80"
            keyboardType="decimal-pad"
          />
          <Text className="absolute right-4 text-light-matte-black/70 font-medium">
            points
          </Text>
        </View>
        {amount &&
        !isNaN(parseFloat(amount)) &&
        parseFloat(amount) > 0 &&
        parseFloat(amount) < 15000 ? (
          <Text className="text-red-500 text-xs mt-1.5 ml-1">
            Minimum 15,000 points
          </Text>
        ) : amount && !isNaN(parseFloat(amount)) && parseFloat(amount) >= 15000 ? (
          <Text className="text-light-matte-black/50 text-xs mt-1.5 ml-1">
            Deposit {Number(amount).toLocaleString()} {tokenSymbol} to receive{" "}
            {Number(amount).toLocaleString()} points
          </Text>
        ) : null}
      </View>
    );
  }
);

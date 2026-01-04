import { Plus, X } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TAddTokenFormProps } from "@/constants/types/assetTypes";

type AddTokenFormPropsExtended = TAddTokenFormProps & {
  onClose?: () => void;
};

const AddTokenForm = ({
  state,
  onAddressChange,
  onSubmit,
  onClose,
}: AddTokenFormPropsExtended) => {
  const { tokenAddress, isLoading } = state;
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-4"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-xl bg-light-primary-red/10 items-center justify-center mr-2">
            <Plus size={16} color="#c71c4b" />
          </View>
          <Text className="text-light-matte-black font-bold text-base">
            Add Custom Token
          </Text>
        </View>
        {onClose && (
          <Pressable
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
          >
            <X size={16} color="#666" />
          </Pressable>
        )}
      </View>

      <TextInput
        className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 text-light-matte-black text-sm"
        placeholder="Enter token contract address (0x...)"
        placeholderTextColor="#9ca3af"
        value={tokenAddress}
        onChangeText={onAddressChange}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        onPress={onSubmit}
        disabled={isLoading || !tokenAddress}
        className={`rounded-xl py-3.5 items-center flex-row justify-center ${
          tokenAddress ? "bg-light-primary-red" : "bg-light-primary-red/50"
        }`}
        style={
          tokenAddress
            ? {
                shadowColor: "#c71c4b",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }
            : {}
        }
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Plus size={18} color="#fff" />
            <Text className="text-white font-bold ml-1">Add Token</Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

export default AddTokenForm;

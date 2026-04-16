import React, { useCallback, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { authenticateBiometric, isBiometricAvailable } from "@/services/security/appLock";

interface BiometricPromptProps {
  reason?: string;
  onSuccess: () => void;
  onFallbackToPin: () => void;
  onCancel?: () => void;
}

export function BiometricPrompt({ reason, onSuccess, onFallbackToPin, onCancel }: BiometricPromptProps) {
  const attempt = useCallback(async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      onFallbackToPin();
      return;
    }

    const success = await authenticateBiometric(reason);
    if (success) {
      onSuccess();
    } else {
      onFallbackToPin();
    }
  }, [reason, onSuccess, onFallbackToPin]);

  useEffect(() => {
    attempt();
  }, [attempt]);

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8">
      <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Authentication Required
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
        {reason ?? "Authenticate to continue"}
      </Text>

      <Pressable onPress={attempt} className="bg-blue-600 rounded-xl py-4 px-8 mb-4">
        <Text className="text-white font-semibold">Try Again</Text>
      </Pressable>

      <Pressable onPress={onFallbackToPin}>
        <Text className="text-blue-600 dark:text-blue-400 font-medium">Use PIN Instead</Text>
      </Pressable>

      {onCancel && (
        <Pressable onPress={onCancel} className="mt-4">
          <Text className="text-gray-500 dark:text-gray-400">Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

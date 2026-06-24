import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { tapFeedback } from "@/utils/hapticsUtils";

interface PinPadProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  pinLength?: number;
}

export function PinPad({
  title,
  subtitle,
  onComplete,
  onCancel,
  pinLength = 6,
}: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handlePress = useCallback(
    (digit: string) => {
      tapFeedback();
      setError("");
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === pinLength) {
        onComplete(newPin);
        setPin("");
      }
    },
    [pin, pinLength, onComplete],
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  }, []);

  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "back"],
  ];

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 items-center justify-center px-8">
      <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {title}
      </Text>
      {subtitle && (
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          {subtitle}
        </Text>
      )}

      {/* PIN dots */}
      <View className="flex-row mb-8">
        {Array.from({ length: pinLength }).map((_, i) => (
          <View
            key={i}
            className={`w-4 h-4 rounded-full mx-2 ${
              i < pin.length ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </View>

      {error ? (
        <Text className="text-red-500 text-sm mb-4">{error}</Text>
      ) : null}

      {/* Keypad */}
      <View className="w-full max-w-[300px]">
        {KEYS.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row justify-center mb-4">
            {row.map((key) => {
              if (key === "")
                return <View key="empty" className="w-20 h-16 mx-2" />;
              if (key === "back") {
                return (
                  <Pressable
                    key="back"
                    onPress={handleBackspace}
                    className="w-20 h-16 mx-2 items-center justify-center"
                  >
                    <Text className="text-2xl text-gray-600 dark:text-gray-400">
                      {"\u232B"}
                    </Text>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePress(key)}
                  className="w-20 h-16 mx-2 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center active:bg-gray-200 dark:active:bg-gray-700"
                >
                  <Text className="text-2xl font-medium text-gray-900 dark:text-white">
                    {key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {onCancel && (
        <Pressable onPress={onCancel} className="mt-4">
          <Text className="text-blue-600 dark:text-blue-400 font-medium">
            Cancel
          </Text>
        </Pressable>
      )}
    </View>
  );
}

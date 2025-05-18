import React from "react";
import { Text, View, ViewStyle } from "react-native";

type ChipProps = {
  label: string;
  color?: string;
  backgroundColor?: string;
  size?: "small" | "medium" | "large";
  style?: ViewStyle;
};

export default function Chip({
  label,
  color = "#c71c4b",
  backgroundColor = "rgba(199, 28, 75, 0.1)",
  size = "medium",
  style,
}: ChipProps) {
  // Determine padding and font size based on size prop
  const getPadding = () => {
    switch (size) {
      case "small":
        return { paddingHorizontal: 8, paddingVertical: 2 };
      case "large":
        return { paddingHorizontal: 16, paddingVertical: 6 };
      case "medium":
      default:
        return { paddingHorizontal: 12, paddingVertical: 4 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "small":
        return 10;
      case "large":
        return 16;
      case "medium":
      default:
        return 13;
    }
  };

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: 999, // Very high value for pill shape
          ...getPadding(),
        },
        style,
      ]}
    >
      <Text
        style={{
          color,
          fontSize: getFontSize(),
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
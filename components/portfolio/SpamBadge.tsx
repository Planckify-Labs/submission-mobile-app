import React from "react";
import { View, Text, Pressable, Alert } from "react-native";

type SpamSeverity = "safe" | "warn" | "danger" | "phishing" | "honeypot" | "quarantined";

interface SpamBadgeProps {
  severity: SpamSeverity;
  reason?: string;
}

const BADGE_CONFIG: Record<SpamSeverity, { label: string; bg: string; text: string }> = {
  safe: { label: "", bg: "", text: "" },
  warn: { label: "Suspicious", bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-700 dark:text-yellow-300" },
  danger: { label: "Spam", bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300" },
  phishing: { label: "Phishing", bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300" },
  honeypot: { label: "Honeypot", bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300" },
  quarantined: { label: "Quarantined", bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-700 dark:text-orange-300" },
};

export function SpamBadge({ severity, reason }: SpamBadgeProps) {
  if (severity === "safe") return null;

  const config = BADGE_CONFIG[severity];

  const handlePress = () => {
    if (reason) {
      Alert.alert("Token Warning", reason);
    }
  };

  return (
    <Pressable onPress={handlePress} className="ml-1">
      <View className={`px-1.5 py-0.5 rounded ${config.bg}`}>
        <Text className={`text-xs font-medium ${config.text}`}>
          {config.label}
        </Text>
      </View>
    </Pressable>
  );
}

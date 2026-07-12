import { ChevronDown, ChevronRight } from "lucide-react-native";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { WalletAccountGroup } from "@/utils/walletGrouping";

type WalletAccountGroupHeaderProps = {
  group: WalletAccountGroup;
  count: number;
  expanded: boolean;
  collapsible: boolean;
  containsActive: boolean;
  onToggle: () => void;
};

/**
 * Section header for an account group in the wallet pickers. Shows the
 * account avatar, its email (or name) label, a "N wallets · Google"
 * subtitle, and — when collapsible — a chevron to expand/collapse.
 */
const WalletAccountGroupHeader = memo(function WalletAccountGroupHeader({
  group,
  count,
  expanded,
  collapsible,
  containsActive,
  onToggle,
}: WalletAccountGroupHeaderProps) {
  const subtitle = `${count} ${count === 1 ? "wallet" : "wallets"}${
    group.provider ? ` · ${group.provider}` : ""
  }`;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <Pressable
      onPress={collapsible ? onToggle : undefined}
      disabled={!collapsible}
      accessibilityRole={collapsible ? "button" : undefined}
      accessibilityLabel={collapsible ? group.label : undefined}
      accessibilityState={collapsible ? { expanded } : undefined}
      className="flex-row items-center px-2 py-2 mb-1"
    >
      <View className="w-9 h-9 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
        <Text className="text-xs font-bold text-light-primary-red">
          {group.initials}
        </Text>
      </View>
      <View className="flex-1 pr-2">
        <Text
          className="text-light-matte-black font-bold text-sm"
          numberOfLines={1}
        >
          {group.label}
        </Text>
        <Text className="text-light-matte-black/50 text-xs mt-0.5">
          {subtitle}
        </Text>
      </View>
      {containsActive && !expanded ? (
        <View className="w-2 h-2 rounded-full bg-light-primary-red mr-2" />
      ) : null}
      {collapsible ? <Chevron size={18} color="#20222c80" /> : null}
    </Pressable>
  );
});

export default WalletAccountGroupHeader;

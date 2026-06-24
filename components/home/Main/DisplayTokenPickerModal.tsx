import { Search } from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { TToken } from "@/api/types/token";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import OptimizedImage from "@/components/common/OptimizedImage";

interface DisplayTokenPickerModalProps {
  visible: boolean;
  onClose: () => void;
  tokens: TToken[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  title?: string;
}

const DisplayTokenPickerModal = memo(function DisplayTokenPickerModal({
  visible,
  onClose,
  tokens,
  selectedSymbol,
  onSelectSymbol,
  title = "Select Display Token",
}: DisplayTokenPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Native token first (so users landing on a new chain can immediately
  // pick the sensible default), then alphabetical by symbol.
  const orderedTokens = useMemo(() => {
    const copy = [...tokens];
    copy.sort((a, b) => {
      if (a.isNativeCurrency !== b.isNativeCurrency) {
        return a.isNativeCurrency ? -1 : 1;
      }
      return a.symbol.localeCompare(b.symbol);
    });
    return copy;
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedTokens;
    return orderedTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q),
    );
  }, [orderedTokens, searchQuery]);

  const handlePick = useCallback(
    (symbol: string) => {
      onSelectSymbol(symbol);
      onClose();
    },
    [onSelectSymbol, onClose],
  );

  const renderTokenItem = useCallback(
    (token: TToken) => {
      const isSelected = token.symbol === selectedSymbol;
      const containerClass = `flex-row items-center justify-between p-4 rounded-xl mb-2 ${
        isSelected ? "bg-light-primary-red/10" : "bg-light-main-container"
      }`;
      const symbolClass = `font-bold text-base ${
        isSelected ? "text-light-primary-red" : "text-light-primary-red/70"
      }`;
      const nameClass = `font-medium ${
        isSelected ? "text-light-primary-red" : "text-light-matte-black"
      }`;

      return (
        <TouchableOpacity
          key={token.id}
          onPress={() => handlePick(token.symbol)}
          activeOpacity={0.7}
          className={containerClass}
        >
          <View className="flex-row items-center">
            <View className="w-10 aspect-square rounded-full mr-3 items-center justify-center overflow-hidden">
              {token.logoUrl ? (
                <OptimizedImage
                  source={{ uri: token.logoUrl }}
                  style={{ width: 30, height: 30 }}
                  contentFit="contain"
                />
              ) : (
                <Text className={symbolClass}>{token.symbol.charAt(0)}</Text>
              )}
            </View>
            <View>
              <Text className={nameClass}>{token.symbol}</Text>
              <Text className="text-light-matte-black/60 text-sm">
                {token.name}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-light-matte-black/60 text-xs">
              {token.isNativeCurrency
                ? "Native"
                : token.isStablecoin
                  ? "Stablecoin"
                  : "Token"}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [selectedSymbol, handlePick],
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      onClosed={() => setSearchQuery("")}
      borderRadius={28}
      contentClassName="px-6"
    >
      <ModalHeader title={title} />

      <View className="bg-white rounded-3xl p-6 pb-0 shadow-sm">
        <View className="bg-light-main-container rounded-xl mb-4 flex-row items-center px-4 py-2">
          <Search size={20} color="#666" />
          <TextInput
            className="flex-1 ml-2 text-light-matte-black"
            placeholder="Search tokens"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView
          className="max-h-96"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="pb-4">
            {filteredTokens.length === 0 ? (
              <View className="items-center justify-center py-8">
                <Text className="text-light-matte-black/60 text-center">
                  {searchQuery
                    ? "No tokens found matching your search"
                    : "No tokens available on this chain"}
                </Text>
              </View>
            ) : (
              filteredTokens.map((token) => renderTokenItem(token))
            )}
          </View>
        </ScrollView>
      </View>
    </BaseModal>
  );
});

export default DisplayTokenPickerModal;

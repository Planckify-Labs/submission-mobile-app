import { Search } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { TToken } from "@/api/types/token";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import OptimizedImage from "../common/OptimizedImage";

interface TokenSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  selectedToken?: TToken;
  onSelectToken: (token: TToken) => void;
  title?: string;
  tokens: TToken[];
}

const TokenSelectorModal = memo(function TokenSelectorModal({
  visible,
  onClose,
  selectedToken,
  onSelectToken,
  title = "Select Token",
  tokens,
}: TokenSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = useMemo(() => {
    if (!tokens) return [];
    if (!searchQuery) return tokens;

    const lowerQuery = searchQuery.toLowerCase();
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.name.toLowerCase().includes(lowerQuery),
    );
  }, [tokens, searchQuery]);

  useEffect(() => {
    if (visible && tokens && tokens.length > 0) {
      if (
        selectedToken &&
        tokens.some((token) => token.id === selectedToken.id)
      ) {
        return;
      }

      onSelectToken(tokens[0]);
    }
  }, [visible, tokens, selectedToken?.id, onSelectToken, selectedToken]);

  const handleTokenSelect = useCallback(
    (token: TToken) => {
      onSelectToken(token);
    },
    [onSelectToken],
  );

  const SearchInput = useMemo(
    () => (
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
    ),
    [searchQuery],
  );

  const renderTokenItem = useCallback(
    (token: TToken) => {
      const isSelected = selectedToken?.id === token.id;

      const containerStyle = `flex-row items-center justify-between p-4 rounded-xl mb-2 ${
        isSelected ? "bg-light-primary-red/10" : "bg-light-main-container"
      }`;

      const symbolStyle = `font-bold text-base ${
        isSelected ? "text-light-primary-red" : "text-light-primary-red/70"
      }`;

      const nameStyle = `font-medium ${
        isSelected ? "text-light-primary-red" : "text-light-matte-black"
      }`;

      return (
        <TouchableOpacity
          key={token.id}
          onPress={() => handleTokenSelect(token)}
          activeOpacity={0.7}
          className={containerStyle}
        >
          <View className="flex-row items-center">
            <View className="w-10 aspect-square rounded-full mr-3 items-center justify-center overflow-hidden">
              {token?.logoUrl ? (
                <OptimizedImage
                  source={{ uri: token.logoUrl }}
                  style={{ width: 30, height: 30 }}
                  contentFit="contain"
                />
              ) : (
                <Text className={symbolStyle}>{token.symbol.charAt(0)}</Text>
              )}
            </View>
            <View>
              <Text className={nameStyle}>{token.symbol}</Text>
              <Text className="text-light-matte-black/60 text-sm">
                {token.name}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-light-matte-black/60 text-xs">
              {token.isStablecoin ? "Stablecoin" : "Token"}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [selectedToken?.id, handleTokenSelect],
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      borderRadius={28}
      contentClassName="px-6"
    >
      <ModalHeader title={title} />

      <View className="bg-white rounded-3xl p-6 pb-0 shadow-sm">
        {SearchInput}
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
                    : "No tokens available"}
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

export default TokenSelectorModal;

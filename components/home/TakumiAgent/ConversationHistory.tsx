import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { router } from "expo-router";
import {
  Check,
  ChevronRight,
  CopyIcon,
  LogIn,
  Search,
  Wallet,
  X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import OptimizedImage from "@/components/common/OptimizedImage";
import WalletSelectorModal from "@/components/wallet/WalletSelectorModal";
import type { ChainConfig } from "@/constants/configs/chainConfig";
import { useIsAuthenticated } from "@/hooks/queries/useAuth";
import {
  useConversationList,
  useDeleteConversation,
} from "@/hooks/queries/useConversations";
import { useTokens } from "@/hooks/queries/useTokens";
import { useBlockchainsWithStorage } from "@/hooks/useBlockchainsWithStorage";
import { useWallet } from "@/hooks/useWallet";
import {
  buildChainConfigFromBlockchain,
  chainCacheKey,
} from "@/hooks/useWallet.helpers";
import {
  formatChainLabel,
  getNativeSymbol,
} from "@/services/walletKit/chainInfo";
import { copyToClipboard } from "@/utils/helperUtils";

interface ConversationHistory {
  onScrollToChat?: () => void;
  onResumeConversation: (conversationId: string) => void;
}

export default function ConversationHistory({
  onScrollToChat,
  onResumeConversation,
}: ConversationHistory) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showChainSelector, setShowChainSelector] = useState(false);

  const {
    wallets,
    activeWalletIndex,
    activeChain,
    setActiveWallet,
    changeActiveChainToConfig,
  } = useWallet();

  const activeWallet = useMemo(
    () => wallets[activeWalletIndex],
    [wallets, activeWalletIndex],
  );

  const { isAuthenticated, isLoading: isLoadingAuth } = useIsAuthenticated();

  const { data: convListData, isLoading: isLoadingConvs } = useConversationList(
    isAuthenticated === true ? activeWallet?.address : undefined,
  );
  const { mutate: deleteConv } = useDeleteConversation();

  const { data: blockchains, isLoading: isLoadingBlockchains } =
    useBlockchainsWithStorage();

  const { data: nativeTokens, isLoading: isLoadingTokens } = useTokens({
    isNativeCurrency: true,
    isActive: true,
  });

  // Chain list for the selector. Every backend `TBlockchain` row is
  // mapped to a proper `ChainConfig` via `buildChainConfigFromBlockchain`
  // (same helper `useWallet` uses), so EVM + Solana share a single shape
  // and the render path stays chain-agnostic — display labels and the
  // native symbol come from the kit via `formatChainLabel` /
  // `getNativeSymbol`, not from an `if (ns === "X")` branch here.
  const allChains = useMemo(() => {
    if (!blockchains || !nativeTokens) return [];
    return blockchains.map((blockchain) => {
      const config = buildChainConfigFromBlockchain(blockchain);
      const nativeToken =
        blockchain.tokens?.find((t) => t.isNativeCurrency) ??
        blockchain.tokens?.[0];
      return {
        key: chainCacheKey(config),
        config,
        label: formatChainLabel(config),
        symbol: getNativeSymbol(config) ?? nativeToken?.symbol ?? "",
        iconUrl: config.iconUrl ?? nativeToken?.logoUrl,
        isTestnet: config.isTestnet === true,
        blockchainId: blockchain.id,
      };
    });
  }, [blockchains, nativeTokens]);

  const formattedAddress = useMemo(() => {
    if (!activeWallet?.address) return "...";
    return `${activeWallet.address.substring(0, 6)}...${activeWallet.address.substring(activeWallet.address.length - 4)}`;
  }, [activeWallet?.address]);

  const filteredConversations = useMemo(() => {
    const items = convListData?.items ?? [];
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.last_message_preview.toLowerCase().includes(q),
    );
  }, [convListData?.items, searchQuery]);

  const closeChainModal = useCallback(() => setShowChainSelector(false), []);

  const handleChainSelect = useCallback(
    async (config: ChainConfig) => {
      await changeActiveChainToConfig(config);
      closeChainModal();
    },
    [changeActiveChainToConfig, closeChainModal],
  );

  const openChainModal = useCallback(() => setShowChainSelector(true), []);

  const handleWalletSwitch = (index: number) => {
    setActiveWallet(index, { source: "agent" });
    setShowWalletSelector(false);
  };

  return (
    <View className="flex-1 bg-light-main-container">
      <View className="flex-1 px-4">
        <View className="flex-row items-center mb-6">
          <View className="flex-1 bg-light rounded-full flex-row items-center px-4 py-2">
            <Search size={18} color="#20222c" />
            <TextInput
              className="flex-1 py-1 px-3 text-light-matte-black bg-lig"
              placeholder="Search conversations..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={18} color="#20222c" />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity className="relative" onPress={onScrollToChat}>
            <View className="absolute top-0 -right-2">
              <ChevronRight size={40} color="#c71c4b" strokeWidth={1.3} />
            </View>
            <View className="top-0 right-0">
              <ChevronRight size={40} color="#c71c4b" strokeWidth={1.3} />
            </View>
          </TouchableOpacity>
        </View>

        <Text className="text-sm font-light text-gray-500 uppercase mb-3">
          Conversations
        </Text>

        {isLoadingAuth ? (
          <View className="items-center py-8">
            <ActivityIndicator size="small" color="#c71c4b" />
          </View>
        ) : isAuthenticated === false ? (
          <View className="items-center py-10 px-6 flex-1 justify-center">
            <View className="w-14 h-14 rounded-full bg-light-primary-red/10 items-center justify-center mb-3">
              <LogIn size={24} color="#c71c4b" />
            </View>
            <Text className="text-light-matte-black font-semibold text-base mb-1">
              Sign in to see your history
            </Text>
            <Text className="text-sm text-gray-500 text-center mb-4">
              Your conversations with Takumi are saved to your wallet. Sign in
              to view them here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/auth")}
              className="bg-light-primary-red rounded-full px-6 py-3"
            >
              <Text className="text-white font-semibold text-sm">Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlashList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onResumeConversation(item.id)}
                className="rounded-lg px-4 py-3 mb-2 flex-row items-start justify-between"
              >
                <View className="flex-1 mr-3">
                  <Text
                    className="text-light-matte-black font-normal text-base"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.last_message_preview ? (
                    <Text
                      className="text-xs text-gray-500 mt-0.5"
                      numberOfLines={1}
                    >
                      {item.last_message_preview}
                    </Text>
                  ) : null}
                  <Text className="text-[10px] text-gray-400 mt-1">
                    {format(new Date(item.updated_at), "MMM d, yyyy")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    deleteConv({
                      id: item.id,
                      walletAddress: activeWallet?.address ?? "",
                    })
                  }
                  hitSlop={8}
                  className="pt-1"
                >
                  <X size={14} color="#9ca3af" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              isLoadingConvs ? (
                <View className="items-center py-8">
                  <ActivityIndicator size="small" color="#c71c4b" />
                </View>
              ) : (
                <View className="items-center py-8">
                  <Text className="text-sm text-gray-400">
                    No conversations yet
                  </Text>
                </View>
              )
            }
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
          />
        )}
        <View className="flex-row justify-between p-4 px-[4px]">
          <View className="flex-row gap-2 items-center">
            <TouchableOpacity onPress={openChainModal}>
              <View className="aspect-square w-[42px] rounded-full overflow-hidden bg-light/50 border-4 border-light-matte-black/80">
                <OptimizedImage source={{ uri: activeChain?.iconUrl }} />
              </View>
            </TouchableOpacity>
            <View>
              <Text className="text-sm text-light-matte-black font-semibold">
                {activeWallet?.name}
              </Text>
              <Text className="text-[10px] font-bold text-light-matte-black/70">
                {formatChainLabel(activeChain)}
              </Text>
              <TouchableOpacity
                className="flex-row gap-2"
                onPress={() =>
                  copyToClipboard(
                    activeWallet?.address || "failed to copy wallet address",
                    "Wallet Address",
                  )
                }
              >
                <Text className="text-xs text-light-matte-black/80">
                  {formattedAddress}
                </Text>
                <CopyIcon color="#c71c4b" size={13} />
              </TouchableOpacity>
            </View>
          </View>
          <View>
            <TouchableOpacity
              className="p-4 aspect-square rounded-full"
              onPress={() => setShowWalletSelector(true)}
            >
              <Wallet size={25} color="#c71c4b" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <WalletSelectorModal
        visible={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
        wallets={wallets}
        activeWalletIndex={activeWalletIndex}
        onSelectWallet={handleWalletSwitch}
        title="Switch Wallet"
      />

      <BaseModal
        visible={showChainSelector}
        onClose={closeChainModal}
        height="67%"
        contentClassName="px-6"
      >
        <ModalHeader title="Select Network" />

        <ScrollView className="flex-1">
          {isLoadingBlockchains || isLoadingTokens ? (
            <View className="items-center justify-center py-8">
              <Text className="text-light-matte-black">
                Loading networks...
              </Text>
            </View>
          ) : (
            allChains.map((chain) => {
              // Chain-agnostic active check — `chainCacheKey` folds each
              // `ChainConfig` into a stable string that encodes the namespace
              // and the chain's own id / cluster, so no `if (ns === "X")`
              // branch is needed here.
              const isActive = chainCacheKey(activeChain) === chain.key;

              return (
                <Pressable
                  key={chain.key}
                  className={`flex-row items-center p-4 mb-2 rounded-xl ${
                    isActive ? "bg-light-primary-red/10" : "bg-light"
                  }`}
                  onPress={() => handleChainSelect(chain.config)}
                >
                  <View className="mr-3 rounded-full overflow-hidden">
                    <OptimizedImage
                      source={{ uri: chain.iconUrl }}
                      style={{ width: 24, height: 24 }}
                    />
                  </View>

                  <View className="flex-1">
                    <Text className="text-light-matte-black font-bold">
                      {chain.label}
                    </Text>
                    <Text className="text-light-matte-black/70 text-sm">
                      {chain.symbol || "N/A"}
                    </Text>
                  </View>

                  {chain.isTestnet && (
                    <View className="bg-yellow-500/20 px-2 py-1 rounded-full mr-2">
                      <Text className="text-yellow-700 text-xs font-medium">
                        Testnet
                      </Text>
                    </View>
                  )}

                  {isActive && (
                    <View className="w-6 h-6 rounded-full bg-light-primary-red/10 items-center justify-center">
                      <Check size={14} color="#c71c4b" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </BaseModal>
    </View>
  );
}

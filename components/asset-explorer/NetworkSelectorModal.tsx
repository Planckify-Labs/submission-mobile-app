import { Check, Search, Star, X } from "lucide-react-native";
import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import { useBlockchains } from "@/hooks/queries/useBlockchains";
import { useActiveNetwork } from "@/hooks/useAssetExplorerState";
import { useNetworkModal } from "@/hooks/useNetworkModal";
import { usePinnedNetworks } from "@/hooks/usePinnedNetworks";
import { filterSupportedBlockchains } from "@/services/walletKit/chainSupport";
import NetworkSelectorModalLoadingSkeletons from "./NetworkSelectorModalLoadingSkeletons";

const NetworkSelectorModal = () => {
  const { isVisible, searchQuery, setSearchQuery, closeModal } =
    useNetworkModal();
  const { activeNetwork, selectNetwork } = useActiveNetwork();
  const { data: blockchains, isLoading } = useBlockchains({ isActive: true });
  const { isPinned, togglePin } = usePinnedNetworks();

  const displayNetworks = useMemo(() => {
    if (!blockchains) return [];

    // Only show networks on supported (Stellar) namespaces. EVM rows
    // use the numeric chainId as the row id; non-EVM rows fall back
    // to `blockchain.id` so they never dereference null.
    const networks = filterSupportedBlockchains(blockchains).map(
      (blockchain) => {
        const nativeToken =
          blockchain.tokens?.find((t) => t.isNativeCurrency) ??
          blockchain.tokens?.[0];
        const rowId =
          typeof blockchain.chainId === "number"
            ? blockchain.chainId.toString()
            : blockchain.id;
        return {
          id: rowId,
          name: blockchain.name,
          symbol: nativeToken?.symbol,
          color: "#627EEA",
          isPinned: true,
          blockchainId: blockchain.id,
          logoUrl: nativeToken?.logoUrl || "",
        };
      },
    );

    if (!searchQuery) return networks;

    return networks.filter(
      (network) =>
        network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        network.symbol?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [blockchains, searchQuery]);

  return (
    <BaseModal
      visible={isVisible}
      onClose={closeModal}
      height="67%"
      contentClassName="px-5 pb-6"
    >
      <ModalHeader title="Networks" />

      <View className="flex-row items-center rounded-xl px-3 h-12 bg-light">
        <Search size={18} color="#20222c60" />
        <TextInput
          className="flex-1 px-3 py-3 text-light-matte-black text-base"
          placeholder="Search networks..."
          placeholderTextColor="#20222c60"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery("")}
            className="bg-gray-200/70 rounded-full w-5 h-5 items-center justify-center"
          >
            <X size={12} color="#20222c" />
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 10 }}
      >
        {isLoading ? (
          <View className="items-center justify-center">
            <NetworkSelectorModalLoadingSkeletons count={5} />
          </View>
        ) : displayNetworks.length === 0 ? (
          <View className="items-center justify-center py-10">
            <Text className="text-light-matte-black/70 font-medium">
              No networks found
            </Text>
          </View>
        ) : (
          displayNetworks.map((item) => (
            <Pressable
              key={item.id}
              className={`flex-row items-center p-3.5 mb-3 rounded-xl ${
                activeNetwork === item.id
                  ? "bg-light-primary-red/10"
                  : "bg-light"
              }`}
              onPress={() => {
                selectNetwork(item.id, item.blockchainId);
                closeModal();
              }}
            >
              <View className="flex-row items-center flex-1">
                {item.logoUrl ? (
                  <Image
                    source={{ uri: item.logoUrl }}
                    className="w-7 h-7 rounded-full mr-3"
                    style={{ backgroundColor: "#f5f5f5" }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    className="w-10 h-10 rounded-full mr-3 items-center justify-center"
                    style={{
                      backgroundColor: item.color || "#627EEA",
                    }}
                  >
                    <Text className="text-white font-bold text-base">
                      {item.symbol?.charAt(0)}
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-light-matte-black font-semibold text-base">
                    {item.name}
                  </Text>
                  <Text className="text-light-matte-black/50 text-xs">
                    {item.symbol}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                {activeNetwork === item.id && (
                  <View className="w-7 h-7 rounded-full bg-light-primary-red/10 items-center justify-center mr-3">
                    <Check size={16} color="#c71c4b" strokeWidth={2.5} />
                  </View>
                )}

                <Pressable
                  className="p-1.5"
                  onPress={() =>
                    togglePin({
                      id: item.id,
                      name: item.name,
                      symbol: item.symbol ?? "",
                      color: item.color ?? "#627EEA",
                      blockchainId: item.blockchainId,
                      logoUrl: item.logoUrl,
                    })
                  }
                  hitSlop={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10,
                  }}
                >
                  <Star
                    size={18}
                    color={isPinned(item.id) ? "#c71c4b" : "#20222c30"}
                    fill={isPinned(item.id) ? "#c71c4b" : "none"}
                  />
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </BaseModal>
  );
};

export default NetworkSelectorModal;

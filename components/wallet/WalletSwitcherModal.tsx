import { Check, Plus, Search, Star, X } from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import Chip from "@/components/common/Chip";
import type { TWallet } from "@/constants/types/walletTypes";
import { usePinnedWallets } from "@/hooks/usePinnedWallets";
import type { Namespace } from "@/services/chains/types";
import { truncateAddress } from "@/utils/walletUtils";

type NamespaceFilter = "all" | Namespace;

const NAMESPACE_LABEL: Record<Namespace, string> = {
  eip155: "EVM",
  solana: "Solana",
  sui: "Sui",
};

type WalletSwitcherModalProps = {
  visible: boolean;
  onClose: () => void;
  wallets: TWallet[];
  activeWalletIndex: number;
  onSelectWallet: (index: number) => void;
  onAddWallet: () => void;
};

const WalletSwitcherModal = memo(function WalletSwitcherModal({
  visible,
  onClose,
  wallets,
  activeWalletIndex,
  onSelectWallet,
  onAddWallet,
}: WalletSwitcherModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [nsFilter, setNsFilter] = useState<NamespaceFilter>("all");

  const { isPinned, togglePin, canPinMore, maxPinned } = usePinnedWallets();

  // Only surface namespace pills the user actually has wallets in —
  // a solo-EVM user shouldn't see a dead "Solana" pill.
  const availableNamespaces = useMemo(() => {
    const set = new Set<Namespace>();
    for (const w of wallets) {
      if (w.namespace) set.add(w.namespace);
    }
    return Array.from(set);
  }, [wallets]);

  const filteredWallets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return wallets.filter((wallet) => {
      if (nsFilter !== "all" && wallet.namespace !== nsFilter) return false;
      if (!query) return true;
      return (
        wallet.name.toLowerCase().includes(query) ||
        wallet.address.toLowerCase().includes(query) ||
        wallet.type.toLowerCase().includes(query)
      );
    });
  }, [wallets, searchQuery, nsFilter]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setNsFilter("all");
  }, []);

  const handleWalletSelect = useCallback(
    (index: number) => {
      onSelectWallet(index);
      onClose();
    },
    [onSelectWallet, onClose],
  );

  const renderWalletItem = useCallback(
    ({ item }: { item: TWallet }) => {
      const originalIndex = wallets.findIndex(
        (w) => w.address === item.address,
      );
      const isActive = originalIndex === activeWalletIndex;
      const pinned = isPinned(item.address);
      // Disabling the pin tap when the cap is hit (and this row isn't
      // already pinned) keeps the UX honest — tapping would otherwise
      // silently no-op and leave users guessing why nothing happened.
      const pinDisabled = !pinned && !canPinMore;

      return (
        <Pressable
          className={`flex-row items-center p-4 mb-2 rounded-xl ${
            isActive ? "bg-light-primary-red/10" : "bg-light"
          }`}
          onPress={() => handleWalletSelect(originalIndex)}
        >
          <View className="flex-1">
            <Text className="text-light-matte-black font-bold">
              {item.name}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-light-matte-black/60 text-sm mr-2">
                {truncateAddress({ address: item.address, preset: "medium" })}
              </Text>
              <Chip label={item.type} size="small" />
            </View>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (pinDisabled) return;
              togglePin(item.address);
            }}
            disabled={pinDisabled}
            accessibilityRole="button"
            accessibilityLabel={pinned ? "Unpin wallet" : "Pin wallet"}
            accessibilityHint={
              pinDisabled ? `Pin limit reached (max ${maxPinned}).` : undefined
            }
            hitSlop={8}
            className="w-9 h-9 rounded-full items-center justify-center mr-2"
          >
            <Star
              size={20}
              color={
                pinned ? "#c71c4b" : pinDisabled ? "#20222c30" : "#20222c80"
              }
              fill={pinned ? "#c71c4b" : "transparent"}
            />
          </Pressable>

          {isActive && (
            <View className="w-6 h-6 rounded-full bg-light-primary-red items-center justify-center">
              <Check size={14} color="#ffffff" strokeWidth={3} />
            </View>
          )}
        </Pressable>
      );
    },
    [
      wallets,
      activeWalletIndex,
      handleWalletSelect,
      isPinned,
      togglePin,
      canPinMore,
      maxPinned,
    ],
  );

  const keyExtractor = useCallback(
    (item: TWallet, index: number) => item.address || `wallet-${index}`,
    [],
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      onClosed={resetFilters}
      height="75%"
      contentClassName="px-4"
    >
      <ModalHeader title="Select Wallet" />

      <View className="mb-3">
        <View className="bg-light rounded-xl flex-row items-center px-4">
          <Search size={18} color="#20222c" />
          <TextInput
            className="flex-1 py-3 px-2 text-light-matte-black"
            placeholder="Search by name, address, or type..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#20222c80"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <X size={16} color="#20222c" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {availableNamespaces.length > 1 ? (
        <View className="mb-3 flex-row">
          {(["all", ...availableNamespaces] as NamespaceFilter[]).map((key) => {
            const isActive = nsFilter === key;
            const label = key === "all" ? "All" : NAMESPACE_LABEL[key];
            return (
              <Pressable
                key={key}
                onPress={() => setNsFilter(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                className={`px-4 py-2 rounded-full mr-2 ${
                  isActive ? "bg-light-primary-red" : "bg-light-matte-black/5"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isActive ? "text-light" : "text-light-matte-black/70"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={filteredWallets}
        renderItem={renderWalletItem}
        keyExtractor={keyExtractor}
        extraData={searchQuery}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-light-matte-black/60">No wallets found</Text>
          </View>
        }
        ListFooterComponent={
          <Pressable
            className="flex-row items-center justify-center p-4 mt-2 border-2 border-dashed border-light-matte-black/15 rounded-xl"
            onPress={() => {
              onClose();
              onAddWallet();
            }}
          >
            <Plus size={20} color="#c71c4b" />
            <Text className="text-light-primary-red font-medium ml-2">
              Add New Wallet
            </Text>
          </Pressable>
        }
      />
    </BaseModal>
  );
});

export default WalletSwitcherModal;

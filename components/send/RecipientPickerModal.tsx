import { BookUser, Search, Wallet, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import type { SectionListData, SectionListRenderItemInfo } from "react-native";
import {
  Platform,
  Pressable,
  SectionList,
  Text,
  TextInput,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";
import type { TWallet } from "@/constants/types/walletTypes";
import type { Namespace } from "@/services/chains/types";
import { truncateAddress } from "@/utils/walletUtils";

function getInitials(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.substring(0, 2).toUpperCase();
}

function getAvatarColor(label: string): string {
  const colors = [
    "#c71c4b",
    "#1c6bc7",
    "#1cb87e",
    "#c77a1c",
    "#6b1cc7",
    "#c71c8e",
  ];
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

type RecipientItem =
  | { type: "wallet"; wallet: TWallet; index: number }
  | { type: "contact"; contact: TAddressBookEntry };

type RecipientPickerModalProps = {
  visible: boolean;
  wallets: TWallet[];
  activeWalletIndex: number;
  /**
   * Active chain's namespace. Used to filter out recipients whose
   * address format doesn't match the active chain — e.g. when the
   * user is sending SOL, only Solana wallets + contacts show up.
   * Prevents the "picked EVM address, broadcast on Solana RPC" class
   * of mistake where funds are locked or lost.
   */
  activeNamespace: Namespace;
  contacts: TAddressBookEntry[];
  onClose: () => void;
  onSelect: (address: string, label: string) => void;
};

export default function RecipientPickerModal({
  visible,
  wallets,
  activeWalletIndex,
  activeNamespace,
  contacts,
  onClose,
  onSelect,
}: RecipientPickerModalProps) {
  const [search, setSearch] = useState("");

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Namespace filter — only show recipients whose address format
    // matches the active chain. Wallets carry an explicit `namespace`
    // field; contacts use the legacy `isEvm` boolean (pre-Solana
    // address-book rows default to EVM).
    const wantsEvm = activeNamespace === "eip155";

    const otherWallets = wallets
      .map((wallet, index) => ({ type: "wallet" as const, wallet, index }))
      .filter(({ index }) => index !== activeWalletIndex)
      .filter(({ wallet }) => wallet.namespace === activeNamespace)
      .filter(
        ({ wallet }) =>
          !q ||
          wallet.name?.toLowerCase().includes(q) ||
          wallet.address.toLowerCase().includes(q),
      );

    const filteredContacts = [...contacts]
      .sort((a, b) => a.label.localeCompare(b.label))
      .filter((c) => (wantsEvm ? c.isEvm !== false : c.isEvm === false))
      .filter(
        (c) =>
          !q ||
          c.label.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          (c.ensName?.toLowerCase().includes(q) ?? false),
      )
      .map((contact) => ({ type: "contact" as const, contact }));

    const result: SectionListData<RecipientItem>[] = [];
    if (otherWallets.length > 0) {
      result.push({ title: "My Wallets", data: otherWallets });
    }
    if (filteredContacts.length > 0) {
      result.push({ title: "Contacts", data: filteredContacts });
    }
    return result;
  }, [wallets, activeWalletIndex, activeNamespace, contacts, search]);

  const handleSelect = useCallback(
    (address: string, label: string) => {
      onSelect(address, label);
      onClose();
    },
    [onSelect, onClose],
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<RecipientItem>) => {
      if (item.type === "wallet") {
        const { wallet, index } = item;
        return (
          <Pressable
            onPress={() =>
              handleSelect(wallet.address, wallet.name || `Wallet ${index + 1}`)
            }
            className="flex-row items-center px-6 py-3 active:bg-light-main-container"
          >
            <View className="w-10 h-10 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
              <Wallet size={18} color="#c71c4b" />
            </View>
            <View className="flex-1">
              <Text
                className="text-[15px] font-semibold text-light-matte-black"
                numberOfLines={1}
              >
                {wallet.name || `Wallet ${index + 1}`}
              </Text>
              <Text
                className="text-xs text-light-matte-black/60"
                style={{
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                }}
                numberOfLines={1}
              >
                {truncateAddress({ address: wallet.address, preset: "medium" })}
              </Text>
            </View>
          </Pressable>
        );
      }

      const { contact } = item;
      const initials = getInitials(contact.label);
      const color = getAvatarColor(contact.label);
      const shortAddress = `${contact.address.substring(0, 6)}...${contact.address.substring(contact.address.length - 4)}`;

      return (
        <Pressable
          onPress={() => handleSelect(contact.address, contact.label)}
          className="flex-row items-center px-6 py-3 active:bg-light-main-container"
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: `${color}18` }}
          >
            <Text className="text-sm font-bold" style={{ color }}>
              {initials}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-[15px] font-semibold text-light-matte-black"
              numberOfLines={1}
            >
              {contact.label}
            </Text>
            <Text
              className="text-xs text-light-matte-black/60"
              style={{
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              }}
              numberOfLines={1}
            >
              {contact.ensName ?? shortAddress}
            </Text>
            {!!contact.chainName && (
              <Text
                className="text-[11px] text-light-matte-black/40 mt-0.5"
                numberOfLines={1}
              >
                {contact.chainName}
              </Text>
            )}
          </View>
        </Pressable>
      );
    },
    [handleSelect],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<RecipientItem> }) => (
      <View className="px-6 pt-4 pb-1 bg-light-main-container">
        <Text className="text-xs font-semibold text-light-matte-black/50 uppercase tracking-widest">
          {section.title}
        </Text>
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: RecipientItem) => {
    if (item.type === "wallet") return `wallet-${item.index}`;
    return `contact-${item.contact.id}`;
  }, []);

  const isEmpty = sections.length === 0;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      onClosed={() => setSearch("")}
      height="75%"
      borderRadius={28}
    >
      <ModalHeader title="Select Recipient" className="px-6" />

      <View
        className="mx-6 mb-3 flex-row items-center bg-white rounded-xl px-4 border"
        style={{ borderColor: "#c71c4b33" }}
      >
        <Search size={15} color="#20222c50" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or address..."
          placeholderTextColor="#20222c40"
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 ml-2 py-3 text-sm text-light-matte-black"
        />
        {!!search && (
          <Pressable
            onPress={() => setSearch("")}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <X size={14} color="#20222c60" />
          </Pressable>
        )}
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-14 h-14 rounded-2xl bg-light-primary-red/10 items-center justify-center mb-3">
            <BookUser size={26} color="#c71c4b" />
          </View>
          <Text className="text-[15px] font-semibold text-light-matte-black text-center mb-1">
            {search
              ? "No results found"
              : `No ${activeNamespace === "solana" ? "Solana" : "Ethereum"} recipients`}
          </Text>
          <Text className="text-xs text-light-matte-black/50 text-center">
            {search
              ? "Try a different name or address"
              : "Only wallets and contacts that match the active chain appear here. Paste an address manually to send to a new recipient."}
          </Text>
        </View>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </BaseModal>
  );
}

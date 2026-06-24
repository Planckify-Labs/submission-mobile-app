import { BookUser, Search, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import type { ListRenderItemInfo } from "react-native";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";

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

type ContactPickerModalProps = {
  visible: boolean;
  contacts: TAddressBookEntry[];
  onClose: () => void;
  onSelect: (contact: TAddressBookEntry) => void;
};

export default function ContactPickerModal({
  visible,
  contacts,
  onClose,
  onSelect,
}: ContactPickerModalProps) {
  const [search, setSearch] = useState("");

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) => a.label.localeCompare(b.label));
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.ensName?.toLowerCase().includes(q) ?? false),
    );
  }, [contacts, search]);

  const handleSelect = useCallback(
    (contact: TAddressBookEntry) => {
      onSelect(contact);
      onClose();
    },
    [onSelect, onClose],
  );

  const renderContact = useCallback(
    ({ item }: ListRenderItemInfo<TAddressBookEntry>) => {
      const initials = getInitials(item.label);
      const color = getAvatarColor(item.label);
      const shortAddress = `${item.address.substring(0, 6)}...${item.address.substring(item.address.length - 4)}`;

      return (
        <Pressable
          onPress={() => handleSelect(item)}
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
              {item.label}
            </Text>
            <Text
              className="text-xs text-light-matte-black/60"
              style={{
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              }}
              numberOfLines={1}
            >
              {item.ensName ? item.ensName : shortAddress}
            </Text>
            {!!item.chainName && (
              <Text
                className="text-[11px] text-light-matte-black/40 mt-0.5"
                numberOfLines={1}
              >
                {item.chainName}
              </Text>
            )}
          </View>
          <View className="px-2 py-1 bg-light-primary-red/10 rounded-lg ml-2">
            <Text className="text-[10px] text-light-primary-red font-semibold">
              SELECT
            </Text>
          </View>
        </Pressable>
      );
    },
    [handleSelect],
  );

  const keyExtractor = useCallback((item: TAddressBookEntry) => item.id, []);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      onClosed={() => setSearch("")}
      height="75%"
      borderRadius={28}
    >
      <ModalHeader
        className="px-6"
        left={
          <View className="flex-row items-center gap-2">
            <BookUser size={20} color="#c71c4b" />
            <Text className="text-xl font-bold text-light-matte-black">
              Address Book
            </Text>
          </View>
        }
      />

      <View
        className="mx-6 mb-3 flex-row items-center bg-white rounded-xl px-4 border"
        style={{ borderColor: "#c71c4b33" }}
      >
        <Search size={15} color="#20222c50" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, address or ENS..."
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

      <FlatList
        style={{ flex: 1 }}
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 4, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="items-center justify-center pt-10 pb-6 px-10">
            <View className="w-14 h-14 rounded-2xl bg-light-primary-red/10 items-center justify-center mb-3">
              <BookUser size={26} color="#c71c4b" />
            </View>
            <Text className="text-[15px] font-semibold text-light-matte-black text-center mb-1">
              {search ? "No results found" : "No contacts saved"}
            </Text>
            <Text className="text-xs text-light-matte-black/50 text-center">
              {search
                ? "Try a different name or address"
                : "Add contacts in the Address Book"}
            </Text>
          </View>
        }
      />
    </BaseModal>
  );
}

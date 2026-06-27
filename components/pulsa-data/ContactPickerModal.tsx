import { FlashList } from "@shopify/flash-list";
import { Contact as ContactIcon, Search, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import type { PhoneContactEntry } from "@/hooks/pulsa-data/useContactPicker";

const AVATAR_COLORS = [
  "#c71c4b",
  "#1c6bc7",
  "#1cb87e",
  "#c77a1c",
  "#6b1cc7",
  "#c71c8e",
];

function getInitials(label: string): string {
  const cleaned = label.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (cleaned.length >= 2) return cleaned.substring(0, 2).toUpperCase();
  return (cleaned[0] ?? "#").toUpperCase();
}

function getAvatarColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type ContactPickerModalProps = {
  visible: boolean;
  contacts: PhoneContactEntry[];
  isLoading: boolean;
  onClose: () => void;
  onSelect: (contact: PhoneContactEntry) => void;
};

export function ContactPickerModal({
  visible,
  contacts,
  isLoading,
  onClose,
  onSelect,
}: ContactPickerModalProps) {
  const [search, setSearch] = useState("");

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.number.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
    );
  }, [contacts, search]);

  const renderContact = useCallback(
    ({ item }: { item: PhoneContactEntry }) => {
      const initials = getInitials(item.name);
      const color = getAvatarColor(item.name);

      return (
        <Pressable
          onPress={() => onSelect(item)}
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
              {item.name}
            </Text>
            <Text
              className="text-xs text-light-matte-black/60"
              numberOfLines={1}
            >
              {item.label ? `${item.label} · ${item.number}` : item.number}
            </Text>
          </View>
          <View className="px-2 py-1 bg-light-primary-red/10 rounded-lg ml-2">
            <Text className="text-[10px] text-light-primary-red font-semibold">
              SELECT
            </Text>
          </View>
        </Pressable>
      );
    },
    [onSelect],
  );

  const keyExtractor = useCallback((item: PhoneContactEntry) => item.id, []);

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
            <ContactIcon size={20} color="#c71c4b" />
            <Text className="text-xl font-bold text-light-matte-black">
              Select Contact
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
          placeholder="Search by name or number..."
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center pb-10">
          <ActivityIndicator color="#c71c4b" />
          <Text className="text-xs text-light-matte-black/50 mt-3">
            Loading your contacts…
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          <FlashList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 4 }}
            ListEmptyComponent={
              <View className="items-center justify-center pt-10 pb-6 px-10">
                <View className="w-14 h-14 rounded-2xl bg-light-primary-red/10 items-center justify-center mb-3">
                  <ContactIcon size={26} color="#c71c4b" />
                </View>
                <Text className="text-[15px] font-semibold text-light-matte-black text-center mb-1">
                  {search ? "No results found" : "No contacts with a number"}
                </Text>
                <Text className="text-xs text-light-matte-black/50 text-center">
                  {search
                    ? "Try a different name or number"
                    : "None of your contacts have a phone number"}
                </Text>
              </View>
            }
          />
        </View>
      )}
    </BaseModal>
  );
}

import { router } from "expo-router";
import { ArrowLeft, Plus, Search, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AddContactModal from "@/components/address-book/AddContactModal";
import AddressBookItem from "@/components/address-book/AddressBookItem";
import EmptyState from "@/components/address-book/EmptyState";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";
import { useAddressBook } from "@/hooks/useAddressBook";

export default function AddressBook() {
  const { contacts, search, setSearch, add, update, remove } = useAddressBook();
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TAddressBookEntry | null>(null);
  const searchRef = useRef<TextInput>(null);
  const { bottom } = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? 0 : bottom > 0 ? bottom : 16;

  const handleCopy = useCallback(async (address: string) => {
    await Clipboard.setStringAsync(address);
    if (Platform.OS === "android") {
      ToastAndroid.show("Address copied", ToastAndroid.SHORT);
    } else {
      Alert.alert("Copied", "Address copied to clipboard", [{ text: "OK" }]);
    }
  }, []);

  const handleEdit = useCallback((entry: TAddressBookEntry) => {
    setEditingEntry(entry);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Contact", "Remove this contact from your address book?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => remove(id),
        },
      ]);
    },
    [remove],
  );

  const handleSave = useCallback(
    (name: string, address: string) => {
      if (editingEntry) {
        update(editingEntry.id, { name, address });
      } else {
        add({ name, address });
      }
    },
    [editingEntry, add, update],
  );

  const handleOpenAdd = useCallback(() => {
    setEditingEntry(null);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingEntry(null);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: TAddressBookEntry; index: number }) => (
      <AddressBookItem
        entry={item}
        index={index}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCopy={handleCopy}
      />
    ),
    [handleEdit, handleDelete, handleCopy],
  );

  const keyExtractor = useCallback((item: TAddressBookEntry) => item.id, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        edges={["top"]}
        className="flex-1 bg-light-main-container"
        style={{ paddingBottom: bottomOffset }}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.back()}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  backgroundColor: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <ArrowLeft size={18} color="#c71c4b" />
              </Pressable>
              <View>
                <Text className="text-light-matte-black text-2xl font-bold tracking-tight">
                  Address Book
                </Text>
                <Text className="text-light-matte-black/50 text-xs">
                  {contacts.length === 0 && !search
                    ? "No contacts saved"
                    : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleOpenAdd}
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                backgroundColor: "#c71c4b",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#c71c4b",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Plus size={20} color="white" />
            </Pressable>
          </View>

          {/* Search bar */}
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 0,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Search size={16} color="#20222c50" />
            <TextInput
              ref={searchRef}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or address..."
              placeholderTextColor="#20222c40"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                marginLeft: 10,
                paddingVertical: 13,
                fontSize: 14,
                color: "#20222c",
              }}
            />
            {!!search && (
              <Pressable
                onPress={() => setSearch("")}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <X size={16} color="#20222c60" />
              </Pressable>
            )}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={contacts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          ListEmptyComponent={<EmptyState isSearching={!!search} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />

        {/* Hint for swipe */}
        {contacts.length > 0 && (
          <View style={{ paddingBottom: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: "#20222c40" }}>
              Swipe left on a contact to edit or delete
            </Text>
          </View>
        )}
      </SafeAreaView>

      <AddContactModal
        visible={showModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        editing={editingEntry}
      />
    </GestureHandlerRootView>
  );
}

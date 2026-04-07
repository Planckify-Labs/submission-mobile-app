import { router } from "expo-router";
import { ArrowLeft, Plus, Search, X } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
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
import type { TCreateAddressBookDto } from "@/api/types/addressBook";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";
import { useAddressBook } from "@/hooks/useAddressBook";

export default function AddressBook() {
  const { contacts, search, setSearch, add, update, remove, refetch, isRefetching, isAdding, isUpdating, addError } = useAddressBook();
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
        { text: "Delete", style: "destructive", onPress: () => remove(id) },
      ]);
    },
    [remove],
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingEntry(null);
  }, []);

  const handleSave = useCallback(
    async (dto: TCreateAddressBookDto) => {
      if (editingEntry) {
        await update(editingEntry.id, dto);
      } else {
        await add(dto);
      }
      handleCloseModal();
    },
    [editingEntry, add, update, handleCloseModal],
  );

  const handleOpenAdd = useCallback(() => {
    setEditingEntry(null);
    setShowModal(true);
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
    <GestureHandlerRootView className="flex-1">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        edges={["top"]}
        className="flex-1 bg-light-main-container"
        style={{ paddingBottom: bottomOffset }}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center gap-3 flex-1">
              <Pressable
                onPress={() => router.back()}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                className="w-9 h-9 rounded-xl bg-light items-center justify-center shadow-sm"
              >
                <ArrowLeft size={18} color="#c71c4b" />
              </Pressable>
              <View className="flex-1">
                <Text className="text-light-matte-black text-2xl font-bold tracking-tight" numberOfLines={1}>
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
              className="w-10 h-10 rounded-[13px] bg-light-primary-red items-center justify-center shadow-md"
              style={{ shadowColor: "#c71c4b" }}
            >
              <Plus size={20} color="white" />
            </Pressable>
          </View>

          {/* Search bar */}
          <View className="mt-3 flex-row items-center bg-light rounded-2xl px-[14px] shadow-sm">
            <Search size={16} color="#20222c50" />
            <TextInput
              ref={searchRef}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, address or ENS..."
              placeholderTextColor="#20222c40"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 ml-[10px] py-[13px] text-sm text-light-matte-black"
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
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState isSearching={!!search} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#c71c4b"
              colors={["#c71c4b"]}
            />
          }
        />

        {/* Swipe hint */}
        {contacts.length > 0 && (
          <View className="pb-2 items-center">
            <Text className="text-[11px] text-light-matte-black/25">
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
        isSaving={isAdding || isUpdating}
        saveError={addError as Error | null}
      />
    </GestureHandlerRootView>
  );
}

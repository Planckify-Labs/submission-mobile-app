import { Check, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type AddContactModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, address: string) => void;
  editing?: TAddressBookEntry | null;
};

export default function AddContactModal({
  visible,
  onClose,
  onSave,
  editing,
}: AddContactModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [saving, setSaving] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const nameRef = useRef<TextInput>(null);
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? "");
      setAddress(editing?.address ?? "");
      setNameError("");
      setAddressError("");
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start(() => {
        nameRef.current?.focus();
      });
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, editing, slideAnim, backdropAnim]);

  const validate = (): boolean => {
    let ok = true;
    const trimName = name.trim();
    const trimAddr = address.trim();

    if (!trimName) {
      setNameError("Name is required");
      ok = false;
    } else if (trimName.length > 32) {
      setNameError("Max 32 characters");
      ok = false;
    } else {
      setNameError("");
    }

    if (!trimAddr) {
      setAddressError("Address is required");
      ok = false;
    } else if (!EVM_ADDRESS_RE.test(trimAddr)) {
      setAddressError("Invalid EVM address (must start with 0x)");
      ok = false;
    } else {
      setAddressError("");
    }

    return ok;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      onSave(name.trim(), address.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const isEdit = !!editing;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(32,34,44,0.55)",
              opacity: backdropAnim,
            }}
          />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              backgroundColor: "#ffffff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: bottom + 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 20,
              elevation: 20,
            }}
          >
            {/* Handle bar */}
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#20222c20",
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: "700", color: "#20222c" }}
              >
                {isEdit ? "Edit Contact" : "Add Contact"}
              </Text>
              <Pressable
                onPress={onClose}
                disabled={saving}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: "#c71c4b12",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#c71c4b" />
              </Pressable>
            </View>

            {/* Name field */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#20222c80",
                  letterSpacing: 0.5,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Name
              </Text>
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (nameError) setNameError("");
                }}
                placeholder="e.g. Alice, Exchange Hot Wallet"
                placeholderTextColor="#20222c40"
                maxLength={32}
                editable={!saving}
                style={{
                  backgroundColor: "#f5f6f9",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  color: "#20222c",
                  borderWidth: 1.5,
                  borderColor: nameError ? "#e53e3e" : "transparent",
                }}
              />
              {nameError ? (
                <Text
                  style={{ fontSize: 11, color: "#e53e3e", marginTop: 4 }}
                >
                  {nameError}
                </Text>
              ) : (
                <Text
                  style={{
                    fontSize: 11,
                    color: "#20222c50",
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {name.length}/32
                </Text>
              )}
            </View>

            {/* Address field */}
            <View style={{ marginBottom: 28 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#20222c80",
                  letterSpacing: 0.5,
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Wallet Address
              </Text>
              <TextInput
                value={address}
                onChangeText={(v) => {
                  setAddress(v);
                  if (addressError) setAddressError("");
                }}
                placeholder="0x..."
                placeholderTextColor="#20222c40"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                style={{
                  backgroundColor: "#f5f6f9",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 13,
                  color: "#20222c",
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  borderWidth: 1.5,
                  borderColor: addressError ? "#e53e3e" : "transparent",
                }}
              />
              {!!addressError && (
                <Text
                  style={{ fontSize: 11, color: "#e53e3e", marginTop: 4 }}
                >
                  {addressError}
                </Text>
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={{
                  flex: 1,
                  backgroundColor: "#f5f6f9",
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#20222c",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  backgroundColor: saving ? "#c71c4b80" : "#c71c4b",
                  borderRadius: 14,
                  paddingVertical: 15,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Check size={16} color="white" />
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "white" }}
                >
                  {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Contact"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

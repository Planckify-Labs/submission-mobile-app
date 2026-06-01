import { Coins, Cpu, Layers, Sparkles, X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UpgradeConfirmationSheetProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function UpgradeConfirmationSheet({
  visible,
  onClose,
  onConfirm,
}: UpgradeConfirmationSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? 16 : bottom > 0 ? bottom : 0;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 2,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, translateY]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              opacity: fadeAnim,
            }}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: bottomOffset + 24,
            backgroundColor: "#f5f6f9",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            transform: [{ translateY: translateY }],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <View className="w-full items-center pt-4 pb-2">
            <View className="w-12 h-1 bg-gray-300 rounded-full" />
          </View>

          <View className="px-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Sparkles size={22} color="#c71c4b" />
                <Text className="text-light-matte-black text-xl font-bold ml-2">
                  Smart Account Upgrade
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="bg-light-main-container p-2 rounded-full"
              >
                <X size={16} color="#20222c" />
              </Pressable>
            </View>

            <Text className="text-light-matte-black/60 text-sm leading-5 mb-6">
              Upgrade your wallet to access premium decentralized finance
              capabilities and advanced wallet features.
            </Text>

            <View className="space-y-4 mb-6">
              <View className="flex-row items-start bg-white p-4 rounded-2xl shadow-sm mb-3">
                <View className="w-10 h-10 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
                  <Coins size={20} color="#c71c4b" />
                </View>
                <View className="flex-1">
                  <Text className="text-light-matte-black font-semibold text-sm">
                    Gas Abstraction & Sponsorship
                  </Text>
                  <Text className="text-light-matte-black/50 text-xs mt-1 leading-4">
                    Pay network fees directly in USDC or enjoy sponsored,
                    gas-free transactions.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start bg-white p-4 rounded-2xl shadow-sm mb-3">
                <View className="w-10 h-10 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
                  <Cpu size={20} color="#c71c4b" />
                </View>
                <View className="flex-1">
                  <Text className="text-light-matte-black font-semibold text-sm">
                    AI-Agent Micropayments
                  </Text>
                  <Text className="text-light-matte-black/50 text-xs mt-1 leading-4">
                    Allow secure, programmatic micropayments initiated by your
                    AI-agent companion.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start bg-white p-4 rounded-2xl shadow-sm mb-4">
                <View className="w-10 h-10 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
                  <Layers size={20} color="#c71c4b" />
                </View>
                <View className="flex-1">
                  <Text className="text-light-matte-black font-semibold text-sm">
                    Batched Transactions
                  </Text>
                  <Text className="text-light-matte-black/50 text-xs mt-1 leading-4">
                    Bundle approval and deposit actions into a single click
                    instead of multiple prompts.
                  </Text>
                </View>
              </View>
            </View>

            <View className="bg-light-main-container/60 p-4 rounded-2xl mb-6">
              <Text className="text-light-matte-black/60 text-xs leading-4 text-center">
                Audited & Secure: Your private keys never leave your device.
                Upgrades use canonical EIP-7702 set-code transactions.
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              className="bg-light-primary-red py-4 rounded-full items-center justify-center mb-3 shadow-md"
              onPress={onConfirm}
            >
              <Text className="text-white font-bold text-base">
                Upgrade to Smart Account
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className="py-3 items-center justify-center"
              onPress={onClose}
            >
              <Text className="text-light-matte-black/50 font-semibold text-sm">
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

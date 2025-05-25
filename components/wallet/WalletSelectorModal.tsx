import { TWallet } from "@/constants/types/walletTypes";
import { Check } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const { height } = Dimensions.get("window");
const MODAL_HEIGHT = height * 0.67;

type WalletSelectorModalProps = {
  visible: boolean;
  onClose: () => void;
  wallets: TWallet[];
  activeWalletIndex: number;
  onSelectWallet: (index: number) => void;
  title?: string;
  disabledWalletIndex?: number;
  disabledLabel?: string;
};

const WalletSelectorModal = memo(function WalletSelectorModal({
  visible,
  onClose,
  wallets,
  activeWalletIndex,
  onSelectWallet,
  title = "Select Wallet",
  disabledWalletIndex,
  disabledLabel = "Current wallet",
}: WalletSelectorModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, translateY]);

  const closeModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: MODAL_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [fadeAnim, translateY, onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState: { dy: number }) => {
        return gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState: { dy: number }) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState: { dy: number; vy: number }) => {
        if (gestureState.dy > 50 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: MODAL_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => closeModal());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 5,
          }).start();
        }
      },
    }),
  ).current;

  const renderWalletItem = useCallback(
    (wallet: TWallet, index: number) => {
      const isActive = index === activeWalletIndex;
      const isDisabled = index === disabledWalletIndex;

      return (
        <Pressable
          key={wallet.address}
          className={`flex-row items-center p-4 mb-2 rounded-xl ${
            isActive ? "bg-light-primary-red/10" : "bg-light-main-container"
          }`}
          onPress={() => onSelectWallet(index)}
          disabled={isDisabled}
        >
          <View className="flex-1">
            <Text
              className={`font-bold ${
                isDisabled
                  ? "text-light-matte-black/40"
                  : "text-light-matte-black"
              }`}
            >
              {wallet.name || `Wallet ${index + 1}`}
            </Text>
            <Text
              className={`text-sm ${
                isDisabled
                  ? "text-light-matte-black/40"
                  : "text-light-matte-black/70"
              }`}
            >
              {wallet.address.substring(0, 6)}...
              {wallet.address.substring(wallet.address.length - 4)}
            </Text>
          </View>

          {isDisabled && disabledLabel && (
            <Text className="text-light-matte-black/40 text-xs mr-2">
              {disabledLabel}
            </Text>
          )}

          {isActive && !isDisabled && (
            <View className="w-6 h-6 rounded-full bg-light-primary-red/10 items-center justify-center">
              <Check size={14} color="#c71c4b" strokeWidth={3} />
            </View>
          )}
        </Pressable>
      );
    },
    [activeWalletIndex, disabledWalletIndex, disabledLabel, onSelectWallet],
  );

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={closeModal}>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
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
            height: MODAL_HEIGHT,
            backgroundColor: "white",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            transform: [{ translateY: translateY }],
          }}
        >
          <View
            {...panResponder.panHandlers}
            className="w-full items-center pt-4 pb-2"
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full" />
          </View>

          <View className="px-6 flex-1">
            <Text className="text-light-matte-black text-xl font-bold mb-4">
              {title}
            </Text>

            <ScrollView className="flex-1">
              {wallets.map((wallet, index) => renderWalletItem(wallet, index))}
            </ScrollView>

            <Pressable
              className="bg-light-main-container p-4 rounded-xl my-4"
              onPress={closeModal}
            >
              <Text className="text-light-matte-black font-bold text-center">
                Close
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

export default WalletSelectorModal;

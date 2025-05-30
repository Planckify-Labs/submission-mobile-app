import { CreditCard, X } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
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

type Token = {
  symbol: string;
  name: string;
};

type TokenSelectorModalProps = {
  visible: boolean;
  onClose: () => void;
  tokens: Token[];
  selectedToken: Token;
  onSelectToken: (token: Token) => void;
  title?: string;
};

const TokenSelectorModal = memo(function TokenSelectorModal({
  visible,
  onClose,
  tokens,
  selectedToken,
  onSelectToken,
  title = "Select Token",
}: TokenSelectorModalProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      fadeAnim.setValue(0);
      translateY.setValue(MODAL_HEIGHT);

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
      setModalVisible(false);
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

  const renderTokenItem = useCallback(
    (token: Token) => {
      const isSelected = token.symbol === selectedToken.symbol;

      return (
        <Pressable
          key={token.symbol}
          className={`flex-row items-center p-4 mb-2 rounded-xl ${
            isSelected ? "bg-light-primary-red/10" : "bg-light-main-container"
          }`}
          onPress={() => onSelectToken(token)}
        >
          <View className="w-10 h-10 rounded-full bg-light-primary-red/10 items-center justify-center mr-3">
            <Text className="text-light-primary-red font-bold">
              {token.symbol.charAt(0)}
            </Text>
          </View>

          <View className="flex-1">
            <Text className="font-bold text-light-matte-black">
              {token.symbol}
            </Text>
            <Text className="text-sm text-light-matte-black/70">
              {token.name}
            </Text>
          </View>

          {isSelected && (
            <View className="w-6 h-6 rounded-full bg-light-primary-red items-center justify-center">
              <CreditCard size={14} color="white" strokeWidth={3} />
            </View>
          )}
        </Pressable>
      );
    },
    [selectedToken, onSelectToken],
  );

  if (!modalVisible) return null;

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

          <View className="px-6 flex-1 relative">
            <Text className="text-light-matte-black text-xl font-bold mb-6 text-center">
              {title}
            </Text>

            <Pressable onPress={closeModal} className="absolute right-6 top-0">
              <View className="w-8 h-8 rounded-full bg-light-matte-black/5 items-center justify-center">
                <X size={18} color="#c71c4b" />
              </View>
            </Pressable>

            <ScrollView className="flex-1">
              {tokens.map((token) => renderTokenItem(token))}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

export default TokenSelectorModal;

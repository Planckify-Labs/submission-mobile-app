import { Search } from "lucide-react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OptimizedImage from "@/components/common/OptimizedImage";
import type { TToken } from "@/api/types/token";

interface DisplayTokenPickerModalProps {
  visible: boolean;
  onClose: () => void;
  tokens: TToken[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  title?: string;
}

const DisplayTokenPickerModal = memo(function DisplayTokenPickerModal({
  visible,
  onClose,
  tokens,
  selectedSymbol,
  onSelectSymbol,
  title = "Select Display Token",
}: DisplayTokenPickerModalProps) {
  const { bottom } = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? 16 : bottom > 0 ? bottom : 0;

  const [searchQuery, setSearchQuery] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(300)).current;

  // Native token first (so users landing on a new chain can immediately
  // pick the sensible default), then alphabetical by symbol.
  const orderedTokens = useMemo(() => {
    const copy = [...tokens];
    copy.sort((a, b) => {
      if (a.isNativeCurrency !== b.isNativeCurrency) {
        return a.isNativeCurrency ? -1 : 1;
      }
      return a.symbol.localeCompare(b.symbol);
    });
    return copy;
  }, [tokens]);

  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedTokens;
    return orderedTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(q) ||
        token.name.toLowerCase().includes(q),
    );
  }, [orderedTokens, searchQuery]);

  const resetAnimation = useCallback(() => {
    fadeAnim.setValue(0);
    translateY.setValue(300);
  }, [fadeAnim, translateY]);

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }),
    ]).start();
  }, [fadeAnim, translateY]);

  const animateOut = useCallback(
    () =>
      new Promise<void>((resolve) => {
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
        ]).start(() => {
          resetAnimation();
          resolve();
        });
      }),
    [resetAnimation, fadeAnim, translateY],
  );

  useEffect(() => {
    if (visible) {
      animateIn();
    }
  }, [visible, animateIn]);

  const handleClose = useCallback(async () => {
    await animateOut();
    setSearchQuery("");
    onClose();
  }, [animateOut, onClose]);

  const handlePick = useCallback(
    async (symbol: string) => {
      onSelectSymbol(symbol);
      await animateOut();
      setSearchQuery("");
      onClose();
    },
    [onSelectSymbol, animateOut, onClose],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 100) {
            handleClose();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [handleClose, translateY],
  );

  const overlayStyle = useMemo(
    (): Animated.WithAnimatedValue<ViewStyle> => ({
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      opacity: fadeAnim,
    }),
    [fadeAnim],
  );

  const modalStyle = useMemo(
    (): Animated.WithAnimatedValue<ViewStyle> => ({
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: bottomOffset,
      backgroundColor: "#f5f6f9",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      transform: [{ translateY }],
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 10,
      opacity: fadeAnim,
    }),
    [fadeAnim, translateY, bottomOffset],
  );

  const renderTokenItem = useCallback(
    (token: TToken) => {
      const isSelected = token.symbol === selectedSymbol;
      const containerClass = `flex-row items-center justify-between p-4 rounded-xl mb-2 ${
        isSelected ? "bg-light-primary-red/10" : "bg-light-main-container"
      }`;
      const symbolClass = `font-bold text-base ${
        isSelected ? "text-light-primary-red" : "text-light-primary-red/70"
      }`;
      const nameClass = `font-medium ${
        isSelected ? "text-light-primary-red" : "text-light-matte-black"
      }`;

      return (
        <TouchableOpacity
          key={token.id}
          onPress={() => handlePick(token.symbol)}
          activeOpacity={0.7}
          className={containerClass}
        >
          <View className="flex-row items-center">
            <View className="w-10 aspect-square rounded-full mr-3 items-center justify-center overflow-hidden">
              {token.logoUrl ? (
                <OptimizedImage
                  source={{ uri: token.logoUrl }}
                  style={{ width: 30, height: 30 }}
                  contentFit="contain"
                />
              ) : (
                <Text className={symbolClass}>{token.symbol.charAt(0)}</Text>
              )}
            </View>
            <View>
              <Text className={nameClass}>{token.symbol}</Text>
              <Text className="text-light-matte-black/60 text-sm">
                {token.name}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-light-matte-black/60 text-xs">
              {token.isNativeCurrency
                ? "Native"
                : token.isStablecoin
                  ? "Stablecoin"
                  : "Token"}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [selectedSymbol, handlePick],
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={overlayStyle} />
        </TouchableWithoutFeedback>

        <Animated.View style={modalStyle}>
          <View
            {...panResponder.panHandlers}
            className="w-full items-center pt-4 pb-2"
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full" />
          </View>

          <View className="px-6 flex-1">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-light-matte-black text-xl font-bold">
                {title}
              </Text>
              <Pressable
                onPress={handleClose}
                className="bg-light-main-container p-2 rounded-full"
              >
                <Text className="text-light-primary-red font-bold">✕</Text>
              </Pressable>
            </View>

            <View className="bg-white rounded-3xl p-6 pb-0 shadow-sm">
              <View className="bg-light-main-container rounded-xl mb-4 flex-row items-center px-4 py-2">
                <Search size={20} color="#666" />
                <TextInput
                  className="flex-1 ml-2 text-light-matte-black"
                  placeholder="Search tokens"
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView
                className="max-h-96"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View className="pb-4">
                  {filteredTokens.length === 0 ? (
                    <View className="items-center justify-center py-8">
                      <Text className="text-light-matte-black/60 text-center">
                        {searchQuery
                          ? "No tokens found matching your search"
                          : "No tokens available on this chain"}
                      </Text>
                    </View>
                  ) : (
                    filteredTokens.map((token) => renderTokenItem(token))
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

export default DisplayTokenPickerModal;

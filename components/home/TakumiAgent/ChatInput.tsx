import { ArrowUp, Maximize2, Mic, Minimize2 } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => Promise<void> | void;
  isLoading?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  isLoading = false,
  placeholder = "Ask me anything...",
}: ChatInputProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const { bottom: bottomInset } = useSafeAreaInsets();

  useEffect(() => {
    if (!value) {
      setContentHeight(0);
    }
  }, [value]);

  const getBorderRadius = () => {
    const lineHeight = 20;
    const estimatedLines = Math.ceil(contentHeight / lineHeight);

    if (estimatedLines <= 1) return 9999;
    if (estimatedLines <= 2) return 24;
    if (estimatedLines <= 3) return 30;
    return 23;
  };

  const hasEnoughLines = Math.ceil(contentHeight / 20) >= 5;
  const isSendDisabled = isLoading || !value.trim();

  const handleSend = useCallback(() => {
    if (isSendDisabled) {
      return Promise.resolve();
    }

    return Promise.resolve(onSend());
  }, [isSendDisabled, onSend]);

  return (
    <>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={bottomInset ? bottomInset + 12 : 12}
        style={{ width: "100%" }}
        className="absolute bottom-0 left-0 w-full"
      >
        <View>
          <View className="flex-row items-center px-3 pb-3 gap-2">
            <View
              style={{
                flex: 1,
                position: "relative",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f5f5f5",
                  borderRadius: getBorderRadius(),
                  paddingHorizontal: 12,
                  borderWidth: 4,
                  borderColor: "#1a1a1a",
                }}
              >
                <TextInput
                  className="flex-1 py-2.5 px-2 text-base text-light-matte-black"
                  placeholder={placeholder}
                  placeholderTextColor="#999"
                  value={value}
                  onChangeText={onChangeText}
                  onContentSizeChange={(e) =>
                    setContentHeight(e.nativeEvent.contentSize.height)
                  }
                  numberOfLines={5}
                  multiline
                  maxLength={1200}
                  editable={!isLoading}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    void handleSend();
                  }}
                />

                <TouchableOpacity
                  className="p-2 justify-center items-center"
                  disabled={isLoading}
                  onPress={() => {
                    // TODO: Implement voice input
                  }}
                >
                  <Mic size={20} color="#c71c4b" />
                </TouchableOpacity>
              </View>

              {hasEnoughLines && (
                <TouchableOpacity
                  className="absolute top-2 right-2 p-2 justify-center items-center"
                  onPress={() => setIsExpanded(true)}
                >
                  <Maximize2 size={15} color="#c71c4b" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              className={`w-11 h-11 rounded-full justify-center items-center ${
                isSendDisabled
                  ? "bg-gray-300 opacity-60"
                  : "bg-light-primary-red"
              }`}
              onPress={() => {
                void handleSend();
              }}
              disabled={isSendDisabled}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <ArrowUp
                  size={23}
                  stroke="#ffffff"
                  strokeWidth={3}
                  color="#ffffff"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={isExpanded}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsExpanded(false)}
      >
        <View className="flex-1 bg-light">
          <View className="flex-1 pl-4 flex-row">
            <TextInput
              className="flex-1 text-base text-light-matte-black"
              placeholder={placeholder}
              placeholderTextColor="#999"
              value={value}
              onChangeText={onChangeText}
              multiline
              maxLength={500}
              editable={!isLoading}
              textAlignVertical="top"
            />

            <TouchableOpacity
              onPress={() => setIsExpanded(false)}
              className="p-2 mt-2"
            >
              <Minimize2 size={20} color="#c71c4b" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between px-4 py-4">
            <TouchableOpacity
              className="p-2 justify-center items-center"
              disabled={isLoading}
              onPress={() => {
                // TODO: Implement voice input
              }}
            >
              <Mic size={20} color="#c71c4b" />
            </TouchableOpacity>

            <TouchableOpacity
              className={`w-11 h-11 rounded-full justify-center items-center ${
                isSendDisabled
                  ? "bg-gray-300 opacity-60"
                  : "bg-light-primary-red"
              }`}
              onPress={() => {
                void handleSend().then(() => setIsExpanded(false));
              }}
              disabled={isSendDisabled}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <ArrowUp
                  size={23}
                  stroke="#ffffff"
                  strokeWidth={3}
                  color="#ffffff"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

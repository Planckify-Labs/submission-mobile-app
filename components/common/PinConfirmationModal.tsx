import { Delete } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import { usePin } from "@/hooks/usePin";
import { errorFeedback, tapFeedback } from "@/utils/hapticsUtils";
import PinSetupModal from "./PinSetupModal";

interface PinConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  title?: string;
  pinLength?: number;
}

const PinConfirmationModal: React.FC<PinConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title = "Confirm with PIN",
  pinLength = 4,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [setupModalVisible, setSetupModalVisible] = useState(false);

  const { hasPin, isLoading, verifyPin, setPin: savePin } = usePin();

  // Reset entry once per open so a previous attempt doesn't carry over.
  useEffect(() => {
    if (visible) {
      setPin("");
      setError("");
    }
  }, [visible]);

  // No PIN yet -> route the user to the setup flow instead.
  useEffect(() => {
    if (visible && !isLoading && !hasPin) {
      setSetupModalVisible(true);
    }
  }, [visible, isLoading, hasPin]);

  const handlePinDigit = async (digit: string) => {
    if (pin.length >= pinLength) return;

    tapFeedback();

    const newPin = pin + digit;
    setPin(newPin);
    setError("");

    if (newPin.length === pinLength) {
      const isValid = await verifyPin(newPin);
      if (isValid) {
        onConfirm(newPin);
      } else {
        errorFeedback();
        setError("Incorrect PIN. Please try again.");
        setPin("");
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleSetupComplete = async (newPin: string) => {
    try {
      await savePin(newPin);
      setSetupModalVisible(false);
    } catch (err) {
      if (__DEV__) console.error("Failed to save PIN:", err);
      setError("Failed to save PIN. Please try again.");
    }
  };

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < pinLength; i++) {
      dots.push(
        <View
          key={i}
          className={`h-4 w-4 rounded-full mx-2 ${
            i < pin.length ? "bg-light-primary-red" : "bg-light-matte-black/20"
          }`}
        />,
      );
    }
    return dots;
  };

  const renderNumberPad = () => {
    const numbers = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "delete"],
    ];

    return numbers.map((row, rowIndex) => (
      <View
        key={rowIndex}
        className="flex-row justify-around flex-1 my-2 gap-2"
      >
        {row.map((num, colIndex) => {
          if (num === "") {
            return <View key={colIndex} className="w-16 h-16" />;
          }

          if (num === "delete") {
            return (
              <TouchableOpacity
                key={colIndex}
                className="w-16 h-16 rounded-full justify-center items-center"
                onPress={handleDelete}
              >
                <Delete size={24} color="#c71c4b" />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={colIndex}
              className="w-16 h-16 rounded-full bg-light-main-container justify-center items-center"
              onPress={() => handlePinDigit(num)}
            >
              <Text className="text-light-matte-black text-2xl font-medium">
                {num}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  };

  if (isLoading) {
    return null;
  }

  return (
    <>
      <BaseModal
        visible={visible && hasPin}
        onClose={onClose}
        height="auto"
        borderRadius={28}
        contentClassName="px-6 pb-2"
      >
        <ModalHeader title={title} />

        <View className="bg-white rounded-3xl p-6 shadow-sm mb-5">
          <Text className="text-light-matte-black/70 mb-6 text-center">
            Please enter your PIN to confirm this action
          </Text>

          <View className="flex-row justify-center items-center mb-6">
            {renderPinDots()}
          </View>

          {error ? (
            <Text className="text-light-primary-red mb-4 text-center">
              {error}
            </Text>
          ) : null}

          <View className="items-center">{renderNumberPad()}</View>
        </View>
      </BaseModal>

      <PinSetupModal
        visible={visible && !hasPin && setupModalVisible}
        onClose={onClose}
        onSetupComplete={handleSetupComplete}
        pinLength={pinLength}
      />
    </>
  );
};

export default PinConfirmationModal;

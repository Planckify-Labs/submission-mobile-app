import { AlertTriangle, Check, CheckCircle } from "lucide-react-native";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import { formatUnits } from "viem";
import type { TToken } from "@/api/types/token";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import OptimizedImage from "./OptimizedImage";
import PinConfirmationModal from "./PinConfirmationModal";

interface SpendingApprovalModalProps {
  visible: boolean;
  onClose: () => void;
  onApprove: (isUnlimited?: boolean) => void;
  onCancel: () => void;
  token: TToken;
  spenderAddress: string;
  amount: string;
  isLoading?: boolean;
  spenderName?: string;
  isInternalContract?: boolean;
}

const SpendingApprovalModal: FC<SpendingApprovalModalProps> = ({
  visible,
  onClose,
  onApprove,
  onCancel,
  token,
  spenderAddress,
  amount,
  isLoading = false,
  spenderName = "Contract",
  isInternalContract = false,
}) => {
  const [unlimitedAllowance, setUnlimitedAllowance] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    // Reset trust checkbox to unchecked each time the modal opens so a
    // previously-selected "trust" doesn't silently carry over.
    if (visible) setUnlimitedAllowance(false);
  }, [visible]);

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const handleApprove = () => {
    setShowPinModal(true);
  };

  const handlePinConfirm = (_pin: string) => {
    setShowPinModal(false);
    onApprove(unlimitedAllowance);
  };

  const handlePinClose = () => {
    setShowPinModal(false);
  };

  const formattedAmount = formatUnits(BigInt(amount), token.decimals);
  const truncatedSpenderAddress = `${spenderAddress.substring(0, 6)}...${spenderAddress.substring(spenderAddress.length - 4)}`;

  return (
    <>
      <BaseModal
        visible={visible}
        onClose={onClose}
        height="auto"
        borderRadius={28}
        contentClassName="px-6 pb-4"
      >
        <ModalHeader title="Spending Approval Required" />

        <View className="bg-white rounded-3xl p-6 shadow-sm mb-6">
          <View className="items-center mb-6">
            <View
              className={`p-4 rounded-full mb-4 ${isInternalContract ? "bg-green-100" : "bg-orange-100"}`}
            >
              {isInternalContract ? (
                <CheckCircle size={32} color="#10b981" />
              ) : (
                <AlertTriangle size={32} color="#f59e0b" />
              )}
            </View>
            <Text className="text-light-matte-black font-bold text-lg text-center mb-2">
              {isInternalContract
                ? "Confirm Token Spending"
                : "Approve Token Spending"}
            </Text>
            <Text className="text-light-matte-black/70 text-center text-sm">
              {isInternalContract
                ? `${spenderName} needs permission to use your tokens for this action`
                : "This contract needs permission to spend your tokens for this action"}
            </Text>
          </View>

          <View className="space-y-4">
            <View className="bg-light-main-container/50 rounded-xl p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-light-matte-black/70 text-sm">Token</Text>
                <View className="flex-row items-center">
                  <View className="w-6 aspect-square rounded-full mr-2 items-center justify-center overflow-hidden">
                    {token.logoUrl ? (
                      <OptimizedImage
                        source={{ uri: token.logoUrl }}
                        style={{ width: 15, height: 15 }}
                        contentFit="contain"
                      />
                    ) : (
                      <Text className="text-light-primary-red text-xs font-bold">
                        {token.symbol.charAt(0)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-light-matte-black font-medium">
                    {token.symbol}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-light-matte-black/70 text-sm">
                  Amount
                </Text>
                <Text className="text-light-matte-black font-medium">
                  {formattedAmount} {token.symbol}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-light-matte-black/70 text-sm">
                  Spender
                </Text>
                <View className="flex-1 items-end">
                  <Text className="text-light-matte-black font-medium text-sm">
                    {spenderName}
                  </Text>
                  <Text className="text-light-matte-black/50 text-xs">
                    {truncatedSpenderAddress}
                  </Text>
                </View>
              </View>
            </View>

            {isInternalContract ? (
              <View className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                <View className="items-start">
                  <View className="flex-row items-start gap-2">
                    <CheckCircle
                      size={16}
                      color="#10b981"
                      className="mr-2 mt-0.5"
                    />
                    <Text className="text-green-800 font-medium text-sm mb-1">
                      Trusted Contract
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-green-700 text-xs">
                      This is a trusted TakumiPay contract that will securely
                      handle this action. Your {token.symbol} tokens will be
                      used only for this transaction.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <View className="flex-row items-start">
                  <AlertTriangle
                    size={16}
                    color="#f59e0b"
                    className="mr-2 mt-0.5"
                  />
                  <View className="flex-1">
                    <Text className="text-orange-800 font-medium text-sm mb-1">
                      Security Notice
                    </Text>
                    <Text className="text-orange-700 text-xs">
                      Only approve spending for contracts you trust. This
                      approval allows the contract to spend your {token.symbol}{" "}
                      tokens.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Pressable
            onPress={() => setUnlimitedAllowance(!unlimitedAllowance)}
            className="flex-row items-center justify-between"
          >
            <View className="flex-1 mr-3">
              <Text className="text-light-matte-black font-medium text-sm mb-1">
                {isInternalContract
                  ? "Trust this contract"
                  : "Unlimited allowance"}
              </Text>
              <Text className="text-light-matte-black/60 text-xs">
                {isInternalContract
                  ? `Allow ${spenderName} to spend your ${token.symbol} tokens without asking again`
                  : `Don't ask for approval again for this contract (not recommended for untrusted contracts)`}
              </Text>
            </View>
            <View
              className={`w-5 h-5 rounded border-2 items-center justify-center ${
                unlimitedAllowance
                  ? "bg-light-primary-red border-light-primary-red"
                  : "border-light-matte-black/30"
              }`}
            >
              {unlimitedAllowance && (
                <Check size={16} color="white" strokeWidth={3.5} />
              )}
            </View>
          </Pressable>
        </View>

        <View className="flex-row space-x-3 gap-2">
          <Pressable
            className="flex-1 bg-light-main-container py-4 rounded-xl items-center"
            onPress={handleCancel}
            disabled={isLoading}
          >
            <Text className="text-light-matte-black font-bold">Cancel</Text>
          </Pressable>

          <TouchableOpacity
            className={`flex-1 bg-light-primary-red py-4 rounded-xl items-center flex-row justify-center ${
              isLoading ? "opacity-50" : ""
            }`}
            onPress={handleApprove}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <Text className="text-white font-bold">Approving...</Text>
            ) : (
              <View className="flex-row items-center gap-2">
                <CheckCircle size={18} color="white" />
                <Text className="text-white font-bold">Approve</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </BaseModal>

      <PinConfirmationModal
        visible={showPinModal}
        onClose={handlePinClose}
        onConfirm={handlePinConfirm}
        title="Confirm Token Approval"
      />
    </>
  );
};

export default SpendingApprovalModal;

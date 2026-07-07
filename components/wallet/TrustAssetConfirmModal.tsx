/**
 * "Trust asset?" confirmation sheet — spec §4.1/§8.3.
 *
 * Matches the app's existing confirm-sheet shell/footer convention
 * (see `components/common/SpendingApprovalModal.tsx` /
 * `SignMessageModal.tsx`): `BaseModal` + `ModalHeader`, a white
 * `rounded-3xl` info card with a centered icon circle, a tinted
 * disclosure box, and a Cancel / primary-action footer row. No native
 * `Alert.alert` — this app reserves that for one-off error toasts, not
 * pre-signing confirmations.
 *
 * PIN-gated, same shape as `SpendingApprovalModal`: tapping "Trust
 * asset" does NOT call `onConfirm` directly — it opens
 * `PinConfirmationModal` first, and only that modal's own successful
 * `onConfirm(pin)` (which internally verifies the PIN via `usePin`)
 * triggers the real `onConfirm` prop.
 */

import { ShieldCheck } from "lucide-react-native";
import type { FC } from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import PinConfirmationModal from "@/components/common/PinConfirmationModal";
import type { TCryptoAsset } from "@/constants/types/assetTypes";

interface TrustAssetConfirmModalProps {
  visible: boolean;
  asset: TCryptoAsset | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const TrustAssetConfirmModal: FC<TrustAssetConfirmModalProps> = ({
  visible,
  asset,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) => {
  const [showPinModal, setShowPinModal] = useState(false);

  if (!asset) return null;

  const handleTrustPress = () => setShowPinModal(true);

  const handlePinConfirm = () => {
    setShowPinModal(false);
    onConfirm();
  };

  const handlePinClose = () => setShowPinModal(false);

  return (
    <>
      <BaseModal
        visible={visible}
        onClose={onCancel}
        height="auto"
        borderRadius={28}
        contentClassName="px-6 pb-4"
        closeButtonDisabled={isSubmitting}
        enableBackdropClose={!isSubmitting}
        enablePanToClose={!isSubmitting}
      >
        <ModalHeader title="Trust this asset?" />

        <View className="bg-white rounded-3xl p-6 shadow-sm mb-6">
          <View className="items-center mb-6">
            <View className="p-4 rounded-full mb-4 bg-light-primary-red/10">
              <ShieldCheck size={32} color="#c71c4b" />
            </View>
            <Text className="text-light-matte-black font-bold text-lg text-center mb-2">
              Trust {asset.symbol}?
            </Text>
            <Text className="text-light-matte-black/70 text-center text-sm">
              This lets your wallet hold {asset.symbol}. You&apos;ll sign one
              transaction to set it up.
            </Text>
          </View>

          <View className="bg-light-primary-red/10 rounded-xl p-4">
            <View className="flex-row items-start">
              <ShieldCheck
                size={16}
                color="#c71c4b"
                style={{ marginTop: 2 }}
                className="mr-2"
              />
              <View className="flex-1">
                <Text className="text-light-matte-black font-medium text-sm mb-1">
                  Reserve requirement
                </Text>
                <Text className="text-light-matte-black/70 text-xs">
                  This locks 0.5 XLM as a minimum reserve balance — a Stellar
                  network requirement, not a fee.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 bg-light-main-container py-4 rounded-xl items-center"
            onPress={onCancel}
            disabled={isSubmitting}
          >
            <Text className="text-light-matte-black font-bold">Cancel</Text>
          </Pressable>
          <Pressable
            className={`flex-1 bg-light-primary-red py-4 rounded-xl items-center flex-row justify-center ${
              isSubmitting ? "opacity-50" : ""
            }`}
            onPress={handleTrustPress}
            disabled={isSubmitting}
          >
            <Text className="text-white font-bold">
              {isSubmitting ? "Trusting…" : "Trust asset"}
            </Text>
          </Pressable>
        </View>
      </BaseModal>

      <PinConfirmationModal
        visible={showPinModal}
        onClose={handlePinClose}
        onConfirm={handlePinConfirm}
        title="Confirm Trustline"
      />
    </>
  );
};

export default TrustAssetConfirmModal;

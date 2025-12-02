import { KeyRound, Shield } from "lucide-react-native";
import React, { lazy, Suspense, useCallback } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import Chip from "@/components/common/Chip";
import { usePerformance } from "@/components/providers/PerformanceProvider";
import AddressDisplay from "@/components/wallet/AddressDisplay";
import type { TWallet } from "@/constants/types/walletTypes";
import { authenticateUser } from "@/utils/authUtils";
import { copyToClipboard } from "@/utils/helperUtils";

const LazyWalletInfoDisplay = lazy(
  () => import("@/components/wallet/WalletInfoDisplay"),
);

const LazyLoadingPlaceholder = () => (
  <View className="py-8 items-center justify-center">
    <ActivityIndicator size="small" color="#c71c4b" />
  </View>
);

type WalletExpandedDetailsProps = {
  wallet: TWallet;
  showWalletInfo: boolean;
  setShowWalletInfo: (show: boolean) => void;
  animatedStyle?: object;
};

export default function WalletExpandedDetails({
  wallet,
  showWalletInfo,
  setShowWalletInfo,
  animatedStyle,
}: WalletExpandedDetailsProps) {
  const { deferredTask } = usePerformance();

  const handleToggleWalletInfo = useCallback(async () => {
    if (!showWalletInfo) {
      const isAuthenticated = await deferredTask(() =>
        authenticateUser("Authenticate to view wallet information"),
      );
      if (isAuthenticated) {
        setShowWalletInfo(true);
      }
    } else {
      setShowWalletInfo(false);
    }
  }, [showWalletInfo, deferredTask, setShowWalletInfo]);

  return (
    <Animated.View
      className="bg-light rounded-3xl overflow-hidden mx-4"
      style={[
        {
          shadowColor: "#20222c",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 8,
        },
        animatedStyle,
      ]}
    >
      {/* Header Section */}
      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-2xl bg-light-primary-red/10 items-center justify-center mr-3">
              <KeyRound size={20} color="#c71c4b" />
            </View>
            <View>
              <Text className="text-light-matte-black font-bold text-base">
                Wallet Details
              </Text>
              <Text className="text-light-matte-black/50 text-xs mt-0.5">
                {wallet.name || "My Wallet"}
              </Text>
            </View>
          </View>
          <Chip label={wallet.source} size="small" />
        </View>
      </View>

      {/* Divider */}
      <View className="h-px bg-light-matte-black/5 mx-5" />

      {/* Content Section */}
      <View className="px-5 py-4">
        <AddressDisplay
          address={wallet.address}
          onCopy={() => copyToClipboard(wallet.address, "Address")}
        />

        <Suspense fallback={<LazyLoadingPlaceholder />}>
          <LazyWalletInfoDisplay
            wallet={wallet}
            showWalletInfo={showWalletInfo}
            onToggleVisibility={handleToggleWalletInfo}
            onCopy={copyToClipboard}
          />
        </Suspense>
      </View>

      {/* Security Footer */}
      {wallet.type !== "Social" && (
        <View className="bg-light-main-container/60 px-5 py-4">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
              <Shield size={14} color="#c71c4b" />
            </View>
            <Text className="text-light-matte-black/60 text-xs flex-1 leading-4">
              Never share your private key or seed phrase. TakumiPay will never
              ask for this information.
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

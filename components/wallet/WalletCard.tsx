import Chip from "@/components/common/Chip";
import { type TWallet, useWallet } from "@/hooks/useWallet";
import { Check, Wallet as WalletIcon } from "lucide-react-native";
import React, { memo, useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

type WalletCardProps = {
  wallet: TWallet;
  isActive: boolean;
  onPress: () => void;
};

const WalletCard = memo(function WalletCard({
  wallet,
  isActive,
  onPress,
}: WalletCardProps) {
  const { width } = useWindowDimensions();
  const { activeChain } = useWallet();
  const isSmallScreen = width < 360;
  const isVerySmallScreen = width < 320;

  const tokenSymbol = useMemo(
    () => activeChain?.chain.nativeCurrency?.symbol || "ETH",
    [activeChain],
  );

  const formattedAddress = useMemo(() => {
    if (!wallet.address) return "...";
    return `${wallet.address.substring(0, 4)}...${wallet.address.substring(wallet.address.length - 4)}`;
  }, [wallet.address]);

  return (
    <Pressable
      className={`p-3 rounded-xl mb-2 flex-row items-center ${
        isActive ? "bg-light-primary-red/10" : "bg-light-main-container"
      }`}
      onPress={onPress}
    >
      <View className="flex-row items-center flex-1 mr-2">
        <WalletIcon
          size={isSmallScreen ? 16 : 18}
          color="#c71c4b"
          className="mr-2"
        />
        <View className="flex-1">
          <Text className="text-light-matte-black font-bold text-sm">
            {wallet.name}
          </Text>
          <View className="flex-row items-center flex-wrap">
            <Text className="text-light-matte-black/70 text-xs">
              {formattedAddress}
            </Text>
            <Chip label={wallet.type} size="small" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </View>

      <View className="items-end">
        {isVerySmallScreen ? (
          <>
            <Text className="text-light-matte-black font-medium text-sm">
              {wallet.balance}
            </Text>
            <Text className="text-light-matte-black/70 text-xs">
              {tokenSymbol}
            </Text>
          </>
        ) : (
          <View className="flex-row items-center">
            <Text className="text-light-matte-black font-medium text-sm">
              {wallet.balance}
            </Text>
            <Text className="text-light-matte-black/70 text-xs ml-1">
              {tokenSymbol}
            </Text>
          </View>
        )}

        {isActive && (
          <View className="mt-1 w-5 h-5 rounded-full bg-light-primary-red/10 items-center justify-center self-end">
            <Check size={12} color="#c71c4b" strokeWidth={3} />
          </View>
        )}
      </View>
    </Pressable>
  );
});

export default WalletCard;

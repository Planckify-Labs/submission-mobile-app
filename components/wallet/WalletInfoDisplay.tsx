import { Copy, Eye, EyeOff, Key, Mail, User } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { TWallet } from "@/constants/types/walletTypes";

type WalletInfoDisplayProps = {
  wallet: TWallet;
  showWalletInfo: boolean;
  onToggleVisibility: () => void;
  onCopy: (text: string, label: string) => void;
};

type ActionButtonProps = {
  onPress: () => void;
  icon: React.ReactNode;
};

function ActionButton({ onPress, icon }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-8 h-8 rounded-xl bg-light-primary-red/10 items-center justify-center active:bg-light-primary-red/20"
    >
      {icon}
    </Pressable>
  );
}

type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-center py-3 border-b border-light-matte-black/5 last:border-b-0">
      <View className="w-8 h-8 rounded-xl bg-light-primary-red/10 items-center justify-center mr-3">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-light-matte-black/50 text-xs">{label}</Text>
        <Text className="text-light-matte-black font-medium text-sm mt-0.5">
          {value}
        </Text>
      </View>
    </View>
  );
}

export default memo(function WalletInfoDisplay({
  wallet,
  showWalletInfo,
  onToggleVisibility,
  onCopy,
}: WalletInfoDisplayProps) {
  if (!wallet || !wallet.type) return null;

  const renderSecretSection = (
    label: string,
    secret: string | undefined,
    secretType: string,
  ) => (
    <View>
      <View className="flex-row items-center mb-2">
        <Key size={12} color="#c71c4b" />
        <Text className="text-light-matte-black/50 text-xs font-medium ml-1 uppercase tracking-wide">
          {label}
        </Text>
      </View>
      <View className="bg-light-main-container/50 p-4 rounded-2xl">
        <Text
          className="text-light-matte-black text-sm leading-5 mb-3"
          numberOfLines={showWalletInfo ? undefined : 2}
        >
          {showWalletInfo && secret
            ? secret
            : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"}
        </Text>
        <View className="flex-row justify-end gap-2">
          <ActionButton
            onPress={onToggleVisibility}
            icon={
              showWalletInfo ? (
                <EyeOff size={14} color="#c71c4b" />
              ) : (
                <Eye size={14} color="#c71c4b" />
              )
            }
          />
          {showWalletInfo && secret && (
            <ActionButton
              onPress={() => onCopy(secret, secretType)}
              icon={<Copy size={14} color="#c71c4b" />}
            />
          )}
        </View>
      </View>
    </View>
  );

  switch (wallet.type) {
    case "SeedPhrase":
      return renderSecretSection(
        "Seed Phrase",
        wallet.seedPhrase,
        "Seed Phrase",
      );

    case "PrivateKey":
      return renderSecretSection(
        "Private Key",
        wallet.privateKey,
        "Private Key",
      );

    case "Social":
      return (
        <View>
          <View className="flex-row items-center mb-2">
            <User size={12} color="#c71c4b" />
            <Text className="text-light-matte-black/50 text-xs font-medium ml-1 uppercase tracking-wide">
              Social Account
            </Text>
          </View>
          <View className="bg-light-main-container/50 rounded-2xl overflow-hidden">
            <InfoRow
              icon={<Key size={14} color="#c71c4b" />}
              label="Provider"
              value={wallet.socialAccount?.provider || "Unknown"}
            />
            <InfoRow
              icon={<Mail size={14} color="#c71c4b" />}
              label="Email"
              value={wallet.socialAccount?.email || "Not available"}
            />
            <InfoRow
              icon={<User size={14} color="#c71c4b" />}
              label="Name"
              value={wallet.socialAccount?.name || "Not available"}
            />
          </View>
        </View>
      );

    default:
      return null;
  }
});

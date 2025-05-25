import type { TWallet } from "@/constants/types/walletTypes";
import React, { memo, useCallback } from "react";
import { FlatList, ListRenderItemInfo, View } from "react-native";
import WalletCard from "./WalletCard";

type WalletListProps = {
  wallets: TWallet[];
  activeWalletIndex: number;
  onSelectWallet: (index: number) => void;
};

const WalletList = memo(function WalletList({
  wallets,
  activeWalletIndex,
  onSelectWallet,
}: WalletListProps) {
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TWallet>) => {
      return (
        <WalletCard
          wallet={item}
          isActive={index === activeWalletIndex}
          onPress={() => onSelectWallet(index)}
        />
      );
    },
    [activeWalletIndex, onSelectWallet],
  );

  const keyExtractor = useCallback(
    (item: TWallet, index: number) => `wallet-${item.address || index}`,
    [],
  );

  const getItemLayout = useCallback(
    (data: ArrayLike<TWallet> | null | undefined, index: number) => ({
      length: 80,
      offset: 80 * index,
      index,
    }),
    [],
  );

  const ItemSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  return (
    <FlatList
      data={wallets}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      ItemSeparatorComponent={ItemSeparator}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      removeClippedSubviews={true}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 10 }}
    />
  );
});

export default WalletList;

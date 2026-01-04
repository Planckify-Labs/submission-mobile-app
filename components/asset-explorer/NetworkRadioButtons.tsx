import { BlurView } from "expo-blur";
import { Maximize2 } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBlockchains } from "@/hooks/queries/useBlockchains";
import { useActiveNetwork, useActiveTab } from "@/hooks/useAssetExplorerState";
import { useNetworkModal } from "@/hooks/useNetworkModal";
import { usePinnedNetworks } from "@/hooks/usePinnedNetworks";
import { useWallet } from "@/hooks/useWallet";
import NetworkRadioButtonLoadingSkeletons from "./NetworkRadioButtonLoadingSkeletons";

const NetworkRadioButtons = () => {
  const { activeChain } = useWallet();
  const { data: blockchains, isLoading } = useBlockchains({ isActive: true });
  const { pinnedNetworks } = usePinnedNetworks();
  const { bottom } = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? 24 : bottom > 0 ? bottom + 8 : 16;

  const { activeNetwork, selectNetwork } = useActiveNetwork();
  const { activeTab } = useActiveTab();
  const { openModal } = useNetworkModal();

  const displayNetworks = React.useMemo(() => {
    if (pinnedNetworks.length > 0) {
      return pinnedNetworks.map((network) => ({
        id: network.id,
        name: network.name,
        symbol: network.symbol,
        color: network.color,
        isPinned: true,
        blockchainId: network.blockchainId,
      }));
    }

    if (!blockchains) return [];

    return blockchains.map((blockchain) => ({
      id: blockchain.chainId.toString(),
      name: blockchain.name,
      symbol: "ETH",
      color: "#627EEA",
      isPinned: true,
      blockchainId: blockchain.id,
    }));
  }, [blockchains, pinnedNetworks]);

  const getAccentColor = () => {
    return activeTab === "my-assets" ? "#c71c4b" : "#20222c";
  };

  const getNetworkIdFromChainId = useCallback(
    (chainId: number): string => {
      const blockchain = blockchains?.find((b) => b.chainId === chainId);
      if (blockchain) {
        return blockchain.chainId.toString();
      }
      return "ethereum";
    },
    [blockchains],
  );

  useEffect(() => {
    if (activeChain?.chain?.id) {
      const networkId = getNetworkIdFromChainId(activeChain.chain.id);
      const blockchain = blockchains?.find(
        (b) => b.chainId === activeChain.chain.id,
      );

      if (blockchain) {
        selectNetwork(networkId, blockchain.id);
      } else if (displayNetworks.some((network) => network.id === networkId)) {
        selectNetwork(networkId);
      }
    }
  }, [
    activeChain?.chain?.id,
    blockchains,
    displayNetworks,
    selectNetwork,
    getNetworkIdFromChainId,
  ]);

  const accentColor = getAccentColor();

  return (
    <View
      className="absolute left-4 right-4 rounded-3xl overflow-hidden"
      style={{
        bottom: bottomOffset,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
      }}
    >
      <BlurView intensity={80} tint="light" className="flex-row items-center">
        <View className="flex-1 flex-row items-center bg-white/80 py-2 pl-2 pr-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            <View className="flex-row items-center gap-1.5">
              {isLoading ? (
                <NetworkRadioButtonLoadingSkeletons />
              ) : (
                displayNetworks.map((network) => {
                  const isActive = activeNetwork === network.id;
                  return (
                    <TouchableOpacity
                      key={network.id}
                      activeOpacity={0.7}
                      onPress={() =>
                        selectNetwork(network.id, network.blockchainId)
                      }
                      className={`px-3.5 py-2.5 rounded-2xl flex-row items-center ${
                        isActive ? "" : "bg-gray-100/80"
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: accentColor,
                              shadowColor: accentColor,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.3,
                              shadowRadius: 6,
                              elevation: 4,
                            }
                          : {}
                      }
                    >
                      <View
                        className={`w-2 h-2 rounded-full mr-2`}
                        style={{
                          backgroundColor: isActive
                            ? "#fff"
                            : network.color || accentColor,
                        }}
                      />
                      <Text
                        className={`font-semibold text-xs ${
                          isActive ? "text-white" : "text-light-matte-black"
                        }`}
                      >
                        {network.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Expand button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={openModal}
            className="w-11 h-11 rounded-2xl items-center justify-center ml-1"
            style={{
              backgroundColor: accentColor,
              shadowColor: accentColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 4,
            }}
            accessibilityLabel="Open network selection"
          >
            <Maximize2 size={18} color="white" />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
};

export default NetworkRadioButtons;

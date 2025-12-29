import { MoveDiagonal } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
  const bottomOffset = Platform.OS === "ios" ? 16 : bottom > 0 ? bottom : 0;

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
    return activeTab === "my-assets"
      ? "bg-light-primary-red"
      : "bg-light-matte-black";
  };

  const getBorderColor = () => {
    return activeTab === "my-assets"
      ? "border-light-primary-red"
      : "border-light-matte-black";
  };

  const getAccentTextColor = () => {
    return "text-white";
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
  const borderColor = getBorderColor();
  const accentTextColor = getAccentTextColor();

  return (
    <View
      className={`absolute bottom-4 flex-row justify-center bg-light rounded-full overflow-hidden border-4 ${borderColor}`}
      style={{
        bottom: bottomOffset,
        left: Platform.OS === "ios" ? 16 : 4,
        right: Platform.OS === "ios" ? 16 : 4,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row p-1 pr-10 gap-2">
          {isLoading ? (
            <NetworkRadioButtonLoadingSkeletons />
          ) : (
            displayNetworks.map((network) => (
              <TouchableOpacity
                key={network.id}
                activeOpacity={0.7}
                onPress={() => selectNetwork(network.id, network.blockchainId)}
                className={`px-3 py-2 rounded-full mx-1- flex-row items-center ${
                  activeNetwork === network.id
                    ? accentColor
                    : "bg-light-main-container"
                }`}
              >
                <View
                  className={`w-3 h-3 rounded-full mr-2 ${
                    activeNetwork === network.id
                      ? "bg-white"
                      : activeTab === "my-assets"
                        ? "bg-light-primary-red/70"
                        : "bg-light-matte-black/70"
                  }`}
                />
                <Text
                  className={`${
                    activeNetwork === network.id
                      ? accentTextColor
                      : "text-light-matte-black"
                  } font-medium text-xs`}
                >
                  {network.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
      <TouchableOpacity
        activeOpacity={0.7}
        className={`absolute bottom-[1px] top-[1px] right-[1px] aspect-square ${accentColor} rounded-full items-center justify-center`}
        onPress={openModal}
        accessibilityLabel="Open network selection"
      >
        <MoveDiagonal size={18} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default NetworkRadioButtons;

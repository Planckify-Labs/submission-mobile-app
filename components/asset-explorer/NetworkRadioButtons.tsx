import { BlurView } from "expo-blur";
import { Maximize2 } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
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
import { getEvmChainId } from "@/services/walletKit/chainInfo";
import OptimizedImage from "../common/OptimizedImage";
import NetworkRadioButtonLoadingSkeletons from "./NetworkRadioButtonLoadingSkeletons";

const NetworkRadioButtons = () => {
  const { activeChain } = useWallet();
  const { data: blockchains, isLoading } = useBlockchains({ isActive: true });
  const { pinnedNetworks } = usePinnedNetworks();
  const { bottom } = useSafeAreaInsets();
  const bottomOffset =
    Platform.OS === "ios" ? 24 : bottom > 0 ? bottom + 8 : 16;

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
        logoUrl: network.logoUrl,
      }));
    }

    if (!blockchains) return [];

    // Show every backend network regardless of namespace. EVM rows
    // use the numeric chainId as the row id (existing selection code
    // compares against that); non-EVM rows fall back to the backend
    // `blockchain.id` (a stable UUID) so they never dereference null.
    return blockchains.map((blockchain) => {
      const nativeToken =
        blockchain.tokens?.find((t) => t.isNativeCurrency) ??
        blockchain.tokens?.[0];
      const rowId =
        typeof blockchain.chainId === "number"
          ? blockchain.chainId.toString()
          : blockchain.id;
      return {
        id: rowId,
        name: blockchain.name,
        symbol: nativeToken?.symbol ?? "N/A",
        color: "#627EEA",
        isPinned: true,
        blockchainId: blockchain.id,
        logoUrl: nativeToken?.logoUrl,
      };
    });
  }, [blockchains, pinnedNetworks]);

  const getAccentColor = () => {
    return activeTab === "my-assets" ? "#c71c4b" : "#20222c";
  };

  const activeChainId = getEvmChainId(activeChain);

  // Sync asset-explorer's selected network to the globally-active chain on
  // mount and whenever the user switches chains elsewhere (header / agent).
  // Namespace-aware: matches EVM rows by numeric chainId and non-EVM rows
  // by namespace (backend `isEVM === false` → "solana" in v2.3.0). Without
  // this branch, Solana never selected itself here because the previous
  // `getEvmChainId`-only path returned `undefined` for non-EVM chains.
  //
  // Keyed on a `namespace|chainId` signature (not on the blockchains
  // array itself) so pull-to-refresh — which refetches the blockchains
  // query and hands back a new array reference — doesn't re-run the
  // effect and stomp the user's manual network pick. Only real global
  // chain changes flip the signature and cause a resync.
  const lastSyncedChainRef = useRef<string | null>(null);
  useEffect(() => {
    if (!blockchains) return;

    const signature = `${activeChain.namespace}|${activeChainId ?? ""}`;
    if (lastSyncedChainRef.current === signature) return;

    const matching = blockchains.find((b) => {
      const bNamespace = b.isEVM === false ? "solana" : "eip155";
      if (bNamespace !== activeChain.namespace) return false;
      if (typeof activeChainId === "number") {
        return typeof b.chainId === "number" && b.chainId === activeChainId;
      }
      return true;
    });

    if (!matching) return;

    const networkId =
      typeof matching.chainId === "number"
        ? matching.chainId.toString()
        : matching.id;

    selectNetwork(networkId, matching.id);
    lastSyncedChainRef.current = signature;
  }, [activeChain.namespace, activeChainId, blockchains, selectNetwork]);

  const accentColor = getAccentColor();

  return (
    <View
      className="absolute left-4 right-4 rounded-full overflow-hidden"
      style={{
        bottom: bottomOffset,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 0,
        elevation: 1,
      }}
    >
      <BlurView intensity={80} tint="light" className="flex-row items-center">
        <View className="flex-1 relative flex-row items-center bg-white/80 py-[4px]">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 50, paddingLeft: 4 }}
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
                      className={`rounded-full flex-row overflow-hidden pr-4 items-center ${
                        isActive ? "" : "bg-gray-100/80"
                      }`}
                      style={
                        isActive && {
                          backgroundColor: accentColor,
                        }
                      }
                    >
                      <View className="w-8 h-8 rounded-full mr-2 bg-light-main-container overflow-hidden">
                        <OptimizedImage source={{ uri: network.logoUrl }} />
                      </View>
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
            className="w-11- h-11- aspect-square rounded-full items-center absolute right-[4px] top-[4px] bottom-[4px] justify-center ml-1"
            style={{
              backgroundColor: accentColor,
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

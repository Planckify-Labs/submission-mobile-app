import { Check, ChevronDown, Search, X } from "lucide-react-native";
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";
import type { ChainConfig } from "@/constants/configs/chainConfig";
import { useTokens } from "@/hooks/queries/useTokens";
import { useBlockchainsWithStorage } from "@/hooks/useBlockchainsWithStorage";
import { useWallet } from "@/hooks/useWallet";
import { buildChainConfigFromBlockchain } from "@/hooks/useWallet.helpers";
import type { Namespace } from "@/services/chains/types";
import { walletKitRegistry } from "@/services/walletKit/registry";

export interface ChainSelectorRef {
  open: () => void;
}

type ChainRowItem = {
  key: string;
  namespace: Namespace;
  label: string;
  symbol: string;
  iconUrl: string | undefined;
  isTestnet: boolean;
  evmChainId?: number;
  solanaCluster?: "mainnet-beta" | "devnet";
  suiNetwork?: "mainnet" | "testnet" | "devnet";
  config: ChainConfig;
};

function capitalize(ns: string): string {
  return ns.charAt(0).toUpperCase() + ns.slice(1);
}

function sectionTitleForNamespace(ns: Namespace): string {
  if (ns === "eip155") return "Ethereum";
  try {
    const kit = walletKitRegistry.get(ns);
    return kit.displayName ?? capitalize(ns);
  } catch {
    return capitalize(ns);
  }
}

function sortWithinGroup<T extends { isTestnet: boolean }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.isTestnet === b.isTestnet) return 0;
    return a.isTestnet ? 1 : -1;
  });
}

function ChainRowSkeleton() {
  return (
    <View className="flex-row items-center p-4 mb-2 rounded-xl bg-light">
      <SingleLoadingSekeleton
        width={24}
        height={24}
        borderRadius={12}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <SingleLoadingSekeleton
          width="45%"
          height={14}
          style={{ marginBottom: 6 }}
        />
        <SingleLoadingSekeleton width="28%" height={12} />
      </View>
    </View>
  );
}

function ChainListSkeleton() {
  return (
    <View>
      {[0, 1].map((group) => (
        <View key={group} className="mb-2">
          <SingleLoadingSekeleton
            width={96}
            height={10}
            style={{ marginTop: 8, marginBottom: 12 }}
          />
          <ChainRowSkeleton />
          <ChainRowSkeleton />
          <ChainRowSkeleton />
        </View>
      ))}
    </View>
  );
}

const ChainSelectorBase = forwardRef<ChainSelectorRef>((_, ref) => {
  const { activeChain, changeActiveChain, changeActiveChainToConfig } =
    useWallet();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [switchingRowKey, setSwitchingRowKey] = useState<string | null>(null);

  const { data: blockchains, isLoading: isLoadingBlockchains } =
    useBlockchainsWithStorage({ isActive: true });

  const { data: nativeTokens, isLoading: isLoadingTokens } = useTokens({
    isNativeCurrency: true,
    isActive: true,
  });

  const isLoading = isLoadingBlockchains || isLoadingTokens;

  const grouped = useMemo<Map<Namespace, ChainRowItem[]>>(() => {
    const order: Namespace[] = walletKitRegistry
      .getAll()
      .map((kit) => kit.namespace);

    const groups = new Map<Namespace, ChainRowItem[]>();
    for (const ns of order) groups.set(ns, []);

    if (blockchains && nativeTokens) {
      for (const blockchain of blockchains) {
        const token =
          blockchain.tokens?.find((t) => t.isNativeCurrency) ??
          blockchain.tokens?.[0];
        const config = buildChainConfigFromBlockchain(blockchain);
        let row: ChainRowItem;
        if (config.namespace === "eip155") {
          row = {
            key: `eip155:${blockchain.chainId ?? "unknown"}`,
            namespace: "eip155",
            label: blockchain.name,
            symbol: token?.symbol ?? "",
            iconUrl: token?.logoUrl ?? undefined,
            isTestnet: Boolean(config.isTestnet),
            evmChainId: blockchain.chainId ?? undefined,
            config,
          };
        } else if (config.namespace === "solana") {
          row = {
            key: `solana:${config.cluster}`,
            namespace: "solana",
            label: blockchain.name,
            symbol: token?.symbol ?? "",
            iconUrl: token?.logoUrl ?? config.iconUrl,
            isTestnet: Boolean(config.isTestnet),
            solanaCluster: config.cluster,
            config,
          };
        } else {
          row = {
            key: `sui:${config.network}`,
            namespace: "sui",
            label: blockchain.name,
            symbol: token?.symbol ?? "SUI",
            iconUrl: token?.logoUrl ?? config.iconUrl,
            isTestnet: Boolean(config.isTestnet),
            suiNetwork: config.network,
            config,
          };
        }
        const bucket = groups.get(row.namespace);
        if (bucket) bucket.push(row);
        else groups.set(row.namespace, [row]);
      }
    }

    const final = new Map<Namespace, ChainRowItem[]>();
    for (const [ns, rows] of groups) {
      if (rows.length === 0) continue;
      final.set(ns, sortWithinGroup(rows));
    }
    return final;
  }, [blockchains, nativeTokens]);

  const filteredGrouped = useMemo<Map<Namespace, ChainRowItem[]>>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return grouped;
    const out = new Map<Namespace, ChainRowItem[]>();
    for (const [ns, rows] of grouped) {
      const hits = rows.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.symbol.toLowerCase().includes(q),
      );
      if (hits.length > 0) out.set(ns, hits);
    }
    return out;
  }, [grouped, searchQuery]);

  const openModal = useCallback(() => setModalVisible(true), []);
  const closeModal = useCallback(() => setModalVisible(false), []);

  useImperativeHandle(ref, () => ({ open: openModal }), [openModal]);

  const handleChainSelect = useCallback(
    async (row: ChainRowItem) => {
      setSwitchingRowKey(row.key);

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      try {
        if (row.namespace === "eip155" && typeof row.evmChainId === "number") {
          await changeActiveChain(row.evmChainId);
        } else {
          await changeActiveChainToConfig(row.config);
        }
      } finally {
        setSwitchingRowKey(null);
        closeModal();
      }
    },
    [changeActiveChain, changeActiveChainToConfig, closeModal],
  );

  const isRowActive = useCallback(
    (row: ChainRowItem): boolean => {
      if (row.namespace === "eip155" && activeChain.namespace === "eip155") {
        return activeChain.chain.id === row.evmChainId;
      }
      if (row.namespace === "solana" && activeChain.namespace === "solana") {
        return activeChain.cluster === row.solanaCluster;
      }
      if (row.namespace === "sui" && activeChain.namespace === "sui") {
        return activeChain.network === row.suiNetwork;
      }
      return false;
    },
    [activeChain],
  );

  const renderChainItem = useCallback(
    (row: ChainRowItem) => {
      const isActive = isRowActive(row);
      const isThisSwitching = switchingRowKey === row.key;
      const isAnySwitching = switchingRowKey !== null;

      return (
        <Pressable
          key={row.key}
          className={`flex-row items-center p-4 mb-2 rounded-xl ${
            isActive ? "bg-light-primary-red/10" : "bg-light"
          } ${isAnySwitching && !isThisSwitching ? "opacity-40" : ""}`}
          onPress={() => {
            if (isAnySwitching) return;
            handleChainSelect(row);
          }}
        >
          <Image
            source={{ uri: row.iconUrl }}
            style={{ width: 24, height: 24 }}
            className="mr-3 rounded-full"
            defaultSource={require("@/assets/images/takumipay-logo.png")}
          />

          <View className="flex-1">
            <Text className="text-light-matte-black font-bold">
              {row.label}
            </Text>
            <Text className="text-light-matte-black/70 text-sm">
              {isThisSwitching ? "Switching…" : row.symbol || "N/A"}
            </Text>
          </View>

          {row.isTestnet && !isThisSwitching && (
            <View className="bg-yellow-500/20 px-2 py-1 rounded-full mr-2">
              <Text className="text-yellow-700 text-xs font-medium">
                Testnet
              </Text>
            </View>
          )}

          {isThisSwitching ? (
            <ActivityIndicator size="small" color="#c71c4b" />
          ) : isActive ? (
            <View className="w-6 h-6 rounded-full bg-light-primary-red/10 items-center justify-center">
              <Check size={14} color="#c71c4b" strokeWidth={3} />
            </View>
          ) : null}
        </Pressable>
      );
    },
    [isRowActive, handleChainSelect, switchingRowKey],
  );

  const activeLabel =
    activeChain.namespace === "eip155"
      ? activeChain.chain.name
      : activeChain.namespace === "solana"
        ? `Solana ${activeChain.cluster === "devnet" ? "Devnet" : "Mainnet"}`
        : `Sui ${
            activeChain.network === "mainnet"
              ? "Mainnet"
              : activeChain.network === "testnet"
                ? "Testnet"
                : "Devnet"
          }`;

  return (
    <>
      <Pressable
        onPress={openModal}
        className="flex-row items-center bg-light-main-container px-3 py-2 rounded-full"
      >
        <Image
          source={{
            uri: activeChain.iconUrl,
          }}
          style={{ width: 20, height: 20 }}
          className="mr-2 rounded-full bg-light-matte-black/5"
          defaultSource={require("@/assets/images/takumipay-logo.png")}
        />
        <Text className="text-light-matte-black text-xs font-medium mr-2">
          {activeLabel}
        </Text>
        <ChevronDown size={16} color="#c71c4b" />
      </Pressable>

      <BaseModal
        visible={modalVisible}
        onClose={closeModal}
        onClosed={() => setSearchQuery("")}
        height="67%"
        contentClassName="px-6"
      >
        <ModalHeader title="Select Network" />

        <View className="flex-row items-center bg-light rounded-2xl px-3 py-2 mb-3">
          <Search size={16} color="#20222c80" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search networks"
            placeholderTextColor="#20222c80"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 ml-2 text-light-matte-black"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <X size={14} color="#20222c80" />
            </Pressable>
          )}
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {isLoading ? (
            <ChainListSkeleton />
          ) : filteredGrouped.size === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className="text-light-matte-black/60 text-sm">
                No networks match &quot;{searchQuery}&quot;
              </Text>
            </View>
          ) : (
            Array.from(filteredGrouped.entries()).map(([ns, rows]) => (
              <View key={ns} className="mb-2">
                <Text className="text-light-matte-black/60 text-xs font-semibold uppercase mb-2 mt-2">
                  {sectionTitleForNamespace(ns)}
                </Text>
                {rows.map(renderChainItem)}
              </View>
            ))
          )}
        </ScrollView>
      </BaseModal>
    </>
  );
});

ChainSelectorBase.displayName = "ChainSelector";

const ChainSelector = memo(ChainSelectorBase);

export default ChainSelector;

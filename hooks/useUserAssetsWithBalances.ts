import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { formatUnits } from "viem";
import { buildChainConfigFromBlockchain } from "@/hooks/useWallet.helpers";
import { walletKitRegistry } from "@/services/walletKit/registry";
import { formatTokenAmount } from "@/utils/helperUtils";
import { useActiveNetwork } from "./useAssetExplorerState";
import { useBlockchainsWithStorage } from "./useBlockchainsWithStorage";
import { useUserAssets } from "./useUserAssets";
import { useWallet } from "./useWallet";

type TAssetBalance = {
  assetId: string;
  balance: string;
  isLoading: boolean;
};

export function useUserAssetsWithBalances() {
  const { userAssets, ...userAssetsMethods } = useUserAssets();
  const { activeWallet } = useWallet();
  const queryClient = useQueryClient();

  const { activeNetwork } = useActiveNetwork();
  const { data: blockchains } = useBlockchainsWithStorage();

  const selectedBlockchain = useMemo(() => {
    if (!blockchains || !activeNetwork) return null;
    return (
      blockchains.find(
        (b) =>
          typeof b.chainId === "number" &&
          b.chainId.toString() === activeNetwork,
      ) ??
      blockchains.find((b) => b.id === activeNetwork) ??
      null
    );
  }, [blockchains, activeNetwork]);

  const chainConfig = useMemo(() => {
    if (!selectedBlockchain) return null;
    try {
      return buildChainConfigFromBlockchain(selectedBlockchain);
    } catch {
      return null;
    }
  }, [selectedBlockchain]);

  const kit = useMemo(() => {
    if (!chainConfig) return null;
    try {
      return walletKitRegistry.get(chainConfig.namespace);
    } catch {
      return null;
    }
  }, [chainConfig]);

  const queryKey = useMemo(
    () =>
      [
        "userAssetsBalances",
        activeWallet?.address,
        activeNetwork,
        userAssets.map((a) => a.id).join(","),
      ] as const,
    [activeWallet?.address, activeNetwork, userAssets],
  );

  const enabled = Boolean(
    activeWallet?.address && kit && chainConfig && userAssets.length > 0,
  );

  const balancesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<TAssetBalance[]> => {
      if (!activeWallet?.address || !kit || !chainConfig) return [];

      const nativeDecimals =
        selectedBlockchain?.nativeCurrency?.decimals ??
        selectedBlockchain?.tokens?.find((t) => t.isNativeCurrency)?.decimals;

      const balancePromises = userAssets.map(async (asset) => {
        try {
          let balance: bigint;
          const isNative =
            !asset.contractAddress ||
            asset.contractAddress ===
              "0x0000000000000000000000000000000000000000" ||
            asset.contractAddress === "native";

          if (isNative) {
            balance = await kit.getNativeBalance(
              activeWallet.address,
              chainConfig,
            );
          } else {
            balance = await kit.getTokenBalance(
              activeWallet.address,
              chainConfig,
              asset.contractAddress!,
            );
          }

          const decimals = asset.decimals ?? nativeDecimals ?? 18;
          const formatted = formatUnits(balance, decimals);
          const balanceFormatted = formatTokenAmount(formatted, {
            simplify: false,
          });

          return {
            assetId: asset.id,
            balance: balanceFormatted,
            isLoading: false,
          };
        } catch (error) {
          console.error(`Error fetching balance for ${asset.symbol}:`, error);
          return {
            assetId: asset.id,
            balance: "0",
            isLoading: false,
          };
        }
      });

      return Promise.all(balancePromises);
    },
    enabled,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 15_000,
  });

  const refetchRef = useRef<() => void>(() => {});
  useEffect(() => {
    refetchRef.current = () => {
      queryClient.invalidateQueries({ queryKey });
    };
  }, [queryClient, queryKey]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      refetchRef.current();
      return undefined;
    }, [enabled]),
  );

  useEffect(() => {
    if (!enabled) return;
    const handler = (state: AppStateStatus) => {
      if (state === "active") {
        refetchRef.current();
      }
    };
    const subscription = AppState.addEventListener("change", handler);
    return () => subscription.remove();
  }, [enabled]);

  const userAssetsWithBalances = useMemo(() => {
    const balanceMap = new Map<string, string>();
    balancesQuery.data?.forEach((b) => {
      balanceMap.set(b.assetId, b.balance);
    });

    return userAssets.map((asset) => ({
      ...asset,
      balance: balanceMap.get(asset.id) ?? asset.balance,
    }));
  }, [userAssets, balancesQuery.data]);

  return {
    userAssets: userAssetsWithBalances,
    isLoadingBalances: balancesQuery.isLoading,
    isFetchingBalances: balancesQuery.isFetching,
    refetchBalances: () => refetchRef.current(),
    ...userAssetsMethods,
  };
}

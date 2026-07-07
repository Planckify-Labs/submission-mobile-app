import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { formatUnits } from "viem";
import type { TCryptoAsset } from "@/constants/types/assetTypes";
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
  /**
   * `true` when the wallet doesn't yet trust/hold this asset (Stellar
   * trustlines, spec §4.1/§8.3). Always `false` for namespaces without
   * a receiver-side opt-in step — `kit.hasTrustline` is presence-checked,
   * never a namespace branch.
   */
  needsTrust: boolean;
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

          // Presence-checked — `undefined` on every namespace without a
          // receiver-side opt-in step (spec §4.1/§8.3). Never blocks the
          // balance read if the check itself fails; treat as "not yet
          // confirmed" rather than surfacing an error for a passive read.
          let needsTrust = false;
          if (!isNative && kit.hasTrustline && asset.contractAddress) {
            try {
              const trusted = await kit.hasTrustline({
                chain: chainConfig,
                to: activeWallet.address,
                contractAddress: asset.contractAddress,
              });
              needsTrust = !trusted;
            } catch {
              needsTrust = false;
            }
          }

          return {
            assetId: asset.id,
            balance: balanceFormatted,
            isLoading: false,
            needsTrust,
          };
        } catch (error) {
          console.error(`Error fetching balance for ${asset.symbol}:`, error);
          return {
            assetId: asset.id,
            balance: "0",
            isLoading: false,
            needsTrust: false,
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
    const trustMap = new Map<string, boolean>();
    balancesQuery.data?.forEach((b) => {
      balanceMap.set(b.assetId, b.balance);
      trustMap.set(b.assetId, b.needsTrust);
    });

    return userAssets.map((asset) => ({
      ...asset,
      balance: balanceMap.get(asset.id) ?? asset.balance,
      needsTrust: trustMap.get(asset.id) ?? false,
    }));
  }, [userAssets, balancesQuery.data]);

  // Self-service trustline establishment for an asset already in "My
  // Assets" (spec §4.1/§8.3). Presence-checked via
  // `kit.establishTrustline` — undefined on every namespace without a
  // receiver-side opt-in step, so this is a no-op there.
  //
  // Confirmation is a controlled `pendingTrustAsset` + `confirmTrust`/
  // `cancelTrust` pair (NOT a native `Alert.alert`) so the screen can
  // render the app's own `TrustAssetConfirmModal` — this app's design
  // system uses bespoke `BaseModal`-based confirm sheets for anything
  // pre-signing, matching `SpendingApprovalModal` / `SignMessageModal`.
  const [pendingTrustAsset, setPendingTrustAsset] =
    useState<TCryptoAsset | null>(null);
  const [establishingAssetId, setEstablishingAssetId] = useState<string | null>(
    null,
  );

  const requestTrust = useCallback(
    (asset: TCryptoAsset) => {
      if (
        !kit?.establishTrustline ||
        !chainConfig ||
        !activeWallet ||
        !asset.contractAddress
      ) {
        return;
      }
      setPendingTrustAsset(asset);
    },
    [kit, chainConfig, activeWallet],
  );

  const cancelTrust = useCallback(() => {
    setPendingTrustAsset(null);
  }, []);

  const confirmTrust = useCallback(async () => {
    const asset = pendingTrustAsset;
    if (
      !asset ||
      !kit?.establishTrustline ||
      !chainConfig ||
      !activeWallet ||
      !asset.contractAddress
    ) {
      setPendingTrustAsset(null);
      return;
    }
    // Keep the confirm sheet open (with its "Trusting…" button state)
    // for the whole async call — matches `SpendingApprovalModal`'s
    // actual behavior — rather than closing immediately and relying
    // solely on the asset card's own spinner.
    setEstablishingAssetId(asset.id);
    try {
      await kit.establishTrustline({
        wallet: activeWallet,
        chain: chainConfig,
        contractAddress: asset.contractAddress,
      });
      refetchRef.current();
    } catch (err) {
      if (__DEV__) {
        console.warn(
          "[useUserAssetsWithBalances] establishTrustline failed:",
          err,
        );
      }
      Alert.alert(
        "Couldn't add this asset",
        "We couldn't set up this asset right now. Please try again.",
      );
    } finally {
      setEstablishingAssetId(null);
      setPendingTrustAsset(null);
    }
  }, [pendingTrustAsset, kit, chainConfig, activeWallet]);

  return {
    userAssets: userAssetsWithBalances,
    isLoadingBalances: balancesQuery.isLoading,
    isFetchingBalances: balancesQuery.isFetching,
    refetchBalances: () => refetchRef.current(),
    requestTrust,
    pendingTrustAsset,
    confirmTrust,
    cancelTrust,
    establishingAssetId,
    ...userAssetsMethods,
  };
}

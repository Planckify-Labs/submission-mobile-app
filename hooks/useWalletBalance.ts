import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import type { ChainConfig } from "@/constants/configs/chainConfig";
import QKEY_Wallets from "@/constants/queryKeys/walletQueryKeys";
import type { TWallet } from "@/constants/types/walletTypes";
import { chainCacheKey } from "@/hooks/useWallet.helpers";
import { walletKitRegistry } from "@/services/walletKit/registry";

export function useWalletBalance(wallet?: TWallet, chain?: ChainConfig) {
  // §6.2 — balance is only meaningful when the active chain's namespace
  // matches the wallet's namespace. Same guard `app/wallet.tsx` uses on
  // the header pill. Kit dispatch lives on `walletKitRegistry`, so the
  // EVM/Solana branch disappears from this hook.
  const kit = useMemo(() => {
    if (!wallet?.namespace) return null;
    try {
      return walletKitRegistry.get(wallet.namespace);
    } catch {
      return null;
    }
  }, [wallet?.namespace]);

  const namespaceMatches =
    !!wallet && !!chain && chain.namespace === wallet.namespace;

  const enabled = Boolean(wallet?.address && kit && namespaceMatches);
  const queryClient = useQueryClient();
  const chainKey = chain ? chainCacheKey(chain) : null;
  const queryKey = useMemo(
    () =>
      [
        QKEY_Wallets.balance,
        wallet?.address,
        wallet?.namespace,
        chainKey,
      ] as const,
    [wallet?.address, wallet?.namespace, chainKey],
  );

  const balanceQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!wallet?.address || !kit || !chain || !namespaceMatches) {
        return BigInt(0);
      }
      return kit.getNativeBalance(wallet.address, chain);
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

  const balanceFormatted = useMemo(() => {
    if (!kit || !chain || !namespaceMatches) return "—";
    if (balanceQuery.data === undefined) return "0";
    // Kit emits `"<amount> <symbol>"`; BalanceSection renders the
    // symbol separately (via `selectedToken`) so strip the suffix.
    return kit.formatNativeAmount(balanceQuery.data, chain).split(" ")[0];
  }, [balanceQuery.data, chain, kit, namespaceMatches]);

  return {
    balance: balanceFormatted,
    isLoading: balanceQuery.isLoading,
    isFetching: balanceQuery.isFetching,
    refetch: () => refetchRef.current(),
  };
}

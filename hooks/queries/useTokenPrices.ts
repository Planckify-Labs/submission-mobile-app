/**
 * TanStack Query hook for token prices and portfolio summary.
 */

import { useQuery } from "@tanstack/react-query";
import type { TokenPrice } from "@/services/indexer/types";
import type { PortfolioSummary } from "@/services/tokens/prices";
import {
  computePortfolioTotal,
  fetchTokenPrices,
  getCurrencyPreference,
} from "@/services/tokens/prices";
import type { TokenBalanceItem } from "@/services/tokens/types";

export const priceQueryKeys = {
  prices: (addresses: string[], chainId: number) =>
    ["tokenPrices", addresses.sort().join(","), chainId] as const,
  portfolio: (address: string, chainId: number) =>
    ["portfolioSummary", address, chainId] as const,
};

export function useTokenPricesQuery(addresses: string[], chainId: number) {
  return useQuery<TokenPrice[]>({
    queryKey: priceQueryKeys.prices(addresses, chainId),
    queryFn: () => fetchTokenPrices(addresses, chainId),
    enabled: addresses.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function usePortfolioSummary(
  tokens: TokenBalanceItem[] | undefined,
): PortfolioSummary {
  if (!tokens || tokens.length === 0) {
    const currency = getCurrencyPreference();
    return {
      totalValueUsd: 0,
      totalValueLocal: 0,
      change24hPercent: 0,
      change24hUsd: 0,
      currency,
      exchangeRate: 1,
    };
  }

  const currency = getCurrencyPreference();
  return computePortfolioTotal(
    tokens.map((t) => ({
      balance: t.balance,
      decimals: t.decimals,
      price: t.price,
      change24h: t.change24h,
      isHidden: t.isHidden,
    })),
    currency,
  );
}

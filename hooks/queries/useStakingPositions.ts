/**
 * TanStack Query hook for staking positions (LSTs + ERC-4626 vaults).
 */

import { useQuery } from "@tanstack/react-query";
import { isLST, getLSTInfo, getExchangeRate } from "@/services/staking/lstDetector";
import { detectVault } from "@/services/staking/vaultDetector";
import type { TokenBalanceItem } from "@/services/tokens/types";

export interface StakingPosition {
  contractAddress: string;
  symbol: string;
  name: string;
  balance: bigint;
  decimals: number;
  chainId: number;
  type: "lst" | "vault";
  underlyingSymbol: string;
  underlyingValue: number;
  exchangeRate: number;
  apy?: number;
}

export function useStakingPositions(
  tokens: TokenBalanceItem[] | undefined,
  chainId: number,
) {
  return useQuery({
    queryKey: ["stakingPositions", chainId, tokens?.length],
    queryFn: async (): Promise<StakingPosition[]> => {
      if (!tokens) return [];

      const positions: StakingPosition[] = [];

      for (const token of tokens) {
        // Check LST
        if (isLST(token.contractAddress)) {
          const info = getLSTInfo(token.contractAddress);
          if (!info) continue;

          const rate = await getExchangeRate(token.contractAddress);
          const balance = Number(token.balance) / 10 ** token.decimals;

          positions.push({
            contractAddress: token.contractAddress,
            symbol: token.symbol,
            name: token.name,
            balance: token.balance,
            decimals: token.decimals,
            chainId: token.chainId,
            type: "lst",
            underlyingSymbol: "ETH",
            underlyingValue: balance * rate,
            exchangeRate: rate,
            apy: info.apy,
          });
          continue;
        }

        // Check ERC-4626 vault (only for tokens not in default list)
        if (token.source === "auto-discovered" || token.source === "user-added") {
          const vault = await detectVault(token.contractAddress, token.chainId);
          if (vault) {
            const balance = Number(token.balance) / 10 ** token.decimals;
            positions.push({
              contractAddress: token.contractAddress,
              symbol: token.symbol,
              name: token.name,
              balance: token.balance,
              decimals: token.decimals,
              chainId: token.chainId,
              type: "vault",
              underlyingSymbol: vault.underlyingSymbol,
              underlyingValue: balance * vault.exchangeRate,
              exchangeRate: vault.exchangeRate,
            });
          }
        }
      }

      return positions;
    },
    enabled: !!tokens && tokens.length > 0,
    staleTime: 300_000,
  });
}

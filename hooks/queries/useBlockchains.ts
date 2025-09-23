import { useQuery } from "@tanstack/react-query";
import { blockchainApi } from "@/api/endpoints/blockchains";
import type { TBlockchain } from "@/api/types/blockchain";

interface TUseBlockchainsOptions {
  name?: string;
  chainId?: number;
  isEVM?: boolean;
  isActive?: boolean;
  take?: number;
  cursor?: string;
}

export const useBlockchains = (options?: TUseBlockchainsOptions) => {
  return useQuery<TBlockchain[]>({
    queryKey: ["blockchains", options],
    queryFn: async () => {
      try {
        if (
          options?.name ||
          options?.chainId ||
          options?.isEVM !== undefined ||
          options?.isActive !== undefined ||
          options?.cursor ||
          options?.take
        ) {
          const response = await blockchainApi.searchBlockchains(options);
          console.log("Raw API Response (Search):", response);
          return response;
        } else {
          const response = await blockchainApi.getBlockchainList();
          console.log("Raw API Response (All):", response);
          return response;
        }
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useNativeTokens = (options?: TUseBlockchainsOptions) => {
  const { data: blockchains, isLoading, error } = useBlockchains(options);

  const nativeTokens =
    blockchains?.flatMap(
      (blockchain) =>
        blockchain.tokens?.filter((token) => token.isNativeCurrency) || [],
    ) || [];

  return {
    data: nativeTokens,
    isLoading,
    error,
  };
};

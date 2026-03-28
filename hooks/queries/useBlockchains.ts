import { useQuery } from "@tanstack/react-query";
import { blockchainApi } from "@/api/endpoints/blockchains";
import type { TBlockchain } from "@/api/types/blockchain";
import { storage } from "@/lib/storage/mmkv";

const BLOCKCHAINS_KEY = "cached_blockchains";
const BLOCKCHAINS_TIMESTAMP_KEY = "cached_blockchains_timestamp";
const CACHE_INVALIDATION_TIME = 24 * 60 * 60 * 1000;
const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000;

interface TUseBlockchainsOptions {
  name?: string;
  chainId?: number;
  isEVM?: boolean;
  isActive?: boolean;
  take?: number;
  cursor?: string;
}

export const useBlockchains = (options?: TUseBlockchainsOptions) => {
  const isFiltered = Boolean(
    options?.name ||
      options?.chainId ||
      options?.isEVM !== undefined ||
      options?.isActive !== undefined ||
      options?.cursor ||
      options?.take,
  );

  return useQuery<TBlockchain[]>({
    queryKey: ["blockchains", options],
    queryFn: async () => {
      if (isFiltered) {
        return await blockchainApi.searchBlockchains(options);
      }

      // Synchronous MMKV read for the full list
      const cachedRaw = storage.getString(BLOCKCHAINS_KEY);
      const timestampStr = storage.getString(BLOCKCHAINS_TIMESTAMP_KEY);
      const now = Date.now();
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;

      if (cachedRaw && now - timestamp < CACHE_INVALIDATION_TIME) {
        if (now - timestamp > BACKGROUND_REFRESH_INTERVAL) {
          // Background refresh — fire and forget
          blockchainApi
            .getBlockchainList()
            .then((fresh) => {
              storage.set(BLOCKCHAINS_KEY, JSON.stringify(fresh));
              storage.set(BLOCKCHAINS_TIMESTAMP_KEY, now.toString());
            })
            .catch(console.error);
        }
        return JSON.parse(cachedRaw) as TBlockchain[];
      }

      const response = await blockchainApi.getBlockchainList();
      storage.set(BLOCKCHAINS_KEY, JSON.stringify(response));
      storage.set(BLOCKCHAINS_TIMESTAMP_KEY, now.toString());
      return response;
    },
    staleTime: BACKGROUND_REFRESH_INTERVAL,
    gcTime: CACHE_INVALIDATION_TIME,
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

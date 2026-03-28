import { useQuery } from "@tanstack/react-query";
import { tokenApi } from "@/api/endpoints/tokens";
import type { TToken, TTokenSearchParams } from "@/api/types/token";
import { storage } from "@/lib/storage/mmkv";

const TOKEN_STORAGE_KEY = "cached_tokens";
const TOKEN_TIMESTAMP_KEY = "cached_tokens_timestamp";
const CACHE_INVALIDATION_TIME = 24 * 60 * 60 * 1000;
const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000;

const filterTokens = (tokens: TToken[], options?: TTokenSearchParams) => {
  if (!options) return tokens;
  return tokens.filter((token) => {
    if (options.blockchainId && token.blockchainId !== options.blockchainId)
      return false;
    if (
      options.isStablecoin !== undefined &&
      token.isStablecoin !== options.isStablecoin
    )
      return false;
    if (options.isActive !== undefined && token.isActive !== options.isActive)
      return false;
    return true;
  });
};

const fetchAndCacheTokens = async (): Promise<TToken[]> => {
  const response = await tokenApi.getTokenList();
  // Synchronous MMKV write
  storage.set(TOKEN_STORAGE_KEY, JSON.stringify(response));
  storage.set(TOKEN_TIMESTAMP_KEY, Date.now().toString());
  return response;
};

export const useTokens = (options?: TTokenSearchParams) => {
  return useQuery<TToken[]>({
    queryKey: ["tokens", options],
    queryFn: async () => {
      // Text search always hits the API directly
      if (options?.name || options?.symbol || options?.contractAddress) {
        return await tokenApi.searchTokens(options);
      }

      // Synchronous MMKV read — no await, no I/O waterfall
      const cachedRaw = storage.getString(TOKEN_STORAGE_KEY);
      const timestampStr = storage.getString(TOKEN_TIMESTAMP_KEY);
      const now = Date.now();
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;

      if (cachedRaw && now - timestamp < CACHE_INVALIDATION_TIME) {
        const allTokens: TToken[] = JSON.parse(cachedRaw);

        // Background refresh if stale but not yet expired
        if (now - timestamp > BACKGROUND_REFRESH_INTERVAL) {
          fetchAndCacheTokens().catch(console.error);
        }

        return filterTokens(allTokens, options);
      }

      // Cache miss or expired — fetch from API
      const fresh = await fetchAndCacheTokens();
      return filterTokens(fresh, options);
    },
    staleTime: BACKGROUND_REFRESH_INTERVAL,
    gcTime: CACHE_INVALIDATION_TIME,
  });
};

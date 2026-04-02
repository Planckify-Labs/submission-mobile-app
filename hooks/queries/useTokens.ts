import { useQuery } from "@tanstack/react-query";
import { tokenApi } from "@/api/endpoints/tokens";
import type { TToken, TTokenSearchParams } from "@/api/types/token";
import { storage } from "@/lib/storage/mmkv";

const TOKEN_STORAGE_KEY = "cached_tokens";
const TOKEN_TIMESTAMP_KEY = "cached_tokens_timestamp";
const OFFLINE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — offline fallback only
const STALE_TIME = 5 * 60 * 1000; // 5 minutes — after this, fetch from API on next mount

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

      const cachedRaw = storage.getString(TOKEN_STORAGE_KEY);
      const timestampStr = storage.getString(TOKEN_TIMESTAMP_KEY);
      const now = Date.now();
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;

      // Fast path: cache is still fresh (< 5 min) — no network needed
      if (cachedRaw && now - timestamp < STALE_TIME) {
        return filterTokens(JSON.parse(cachedRaw), options);
      }

      // Cache is stale or missing — fetch from API
      try {
        const fresh = await fetchAndCacheTokens();
        return filterTokens(fresh, options);
      } catch (error) {
        // Offline fallback: serve any MMKV data available, regardless of age
        if (cachedRaw) {
          return filterTokens(JSON.parse(cachedRaw), options);
        }
        throw error;
      }
    },
    staleTime: STALE_TIME,
    gcTime: OFFLINE_CACHE_TTL,
    refetchOnMount: true,
  });
};

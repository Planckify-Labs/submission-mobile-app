import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { queryCache } from "./mmkv";

const CACHE_KEY = "REACT_QUERY_CACHE";

// Query keys that should never be persisted — real-time, polling, or wallet data
// Wallet queries are always reloaded from expo-secure-store on app start, so
// persisting them to MMKV (unencrypted) is both unnecessary and a security concern.
const EXCLUDED_QUERY_KEYS: string[] = [
  "auth", // nonces are single-use — never cache stale nonces across sessions
  "wallet-balance", // live on-chain balance (15s polling)
  "wallets", // reloaded from expo-secure-store on every start
  "active-wallet", // reloaded from expo-secure-store
  "active-wallet-index", // reloaded from expo-secure-store
  "active-chain", // reloaded from expo-secure-store
  "deposit", // point deposit status polling
  "status", // redemption status polling
];

const shouldExclude = (queryKey: readonly unknown[]): boolean => {
  return queryKey.some((segment) =>
    EXCLUDED_QUERY_KEYS.includes(segment as string),
  );
};

export const mmkvPersister: Persister = {
  persistClient(client: PersistedClient) {
    try {
      queryCache.set(CACHE_KEY, JSON.stringify(client));
    } catch {
      // Silently ignore serialization failures (e.g. circular refs)
    }
  },
  restoreClient() {
    try {
      const data = queryCache.getString(CACHE_KEY);
      if (!data) return undefined;
      return JSON.parse(data) as PersistedClient;
    } catch {
      return undefined;
    }
  },
  removeClient() {
    queryCache.remove(CACHE_KEY);
  },
};

// Used in dehydrateOptions.shouldDehydrateQuery to filter persisted queries
export const shouldPersistQuery = (query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean => {
  if (query.state.status !== "success") return false;
  return !shouldExclude(query.queryKey);
};

/**
 * TanStack Query hook wrapping IndexerRegistry.
 * The rest of the app imports useIndexer() — never calls a provider directly.
 */

import { useQuery } from "@tanstack/react-query";
import type { CacheCategory } from "@/services/indexer/cache";
import { getCached, setCache } from "@/services/indexer/cache";
import { indexerRegistry } from "@/services/indexer/registry";
import type {
  ENSResolution,
  HistoryOpts,
  NFTAsset,
  NFTOpts,
  PaginatedResult,
  TokenApproval,
  TokenBalance,
  TokenPrice,
  WalletTransaction,
} from "@/services/indexer/types";

// ─── Cache-wrapped registry calls ────────────────────────────────────

async function cachedCall<T>(
  category: CacheCategory,
  keyParts: (string | number)[],
  method: string,
  args: unknown[],
): Promise<{ data: T; isStale: boolean }> {
  // Check cache first
  const cached = getCached<T>(category, ...keyParts);

  try {
    const result = await indexerRegistry.call<T>(
      method as keyof typeof indexerRegistry.call,
      ...args,
    );
    setCache(category, result, ...keyParts);
    return { data: result, isStale: false };
  } catch (err) {
    // Offline fallback — return stale cached data
    if (cached) {
      return { data: cached.data, isStale: true };
    }
    throw err;
  }
}

// ─── Query Keys ──────────────────────────────────────────────────────

export const indexerQueryKeys = {
  tokenBalances: (address: string, chainId: number) =>
    ["indexer", "tokenBalances", address, chainId] as const,
  transactionHistory: (opts: HistoryOpts) =>
    ["indexer", "history", opts.address, opts.chainId, opts.cursor] as const,
  nfts: (opts: NFTOpts) =>
    ["indexer", "nfts", opts.address, opts.chainId, opts.cursor] as const,
  tokenApprovals: (address: string, chainId: number) =>
    ["indexer", "approvals", address, chainId] as const,
  tokenPrices: (addresses: string[], chainId: number) =>
    ["indexer", "prices", addresses.sort().join(","), chainId] as const,
  ens: (nameOrAddress: string, chainId: number) =>
    ["indexer", "ens", nameOrAddress, chainId] as const,
  tokenMetadata: (contractAddress: string, chainId: number) =>
    ["indexer", "tokenMetadata", contractAddress, chainId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────

export function useTokenBalances(address: string | undefined, chainId: number) {
  return useQuery({
    queryKey: indexerQueryKeys.tokenBalances(address ?? "", chainId),
    queryFn: async () => {
      const result = await cachedCall<TokenBalance[]>(
        "tokenBalances",
        [address!, chainId],
        "getTokenBalances",
        [address!, chainId],
      );
      return result;
    },
    enabled: !!address,
    staleTime: 30_000,
  });
}

export function useTransactionHistory(opts: HistoryOpts | null) {
  return useQuery({
    queryKey: indexerQueryKeys.transactionHistory(
      opts ?? { address: "", chainId: 0 },
    ),
    queryFn: async () => {
      const result = await cachedCall<PaginatedResult<WalletTransaction>>(
        "transactionHistory",
        [opts!.address, opts!.chainId, opts!.cursor ?? ""],
        "getTransactionHistory",
        [opts!],
      );
      return result;
    },
    enabled: !!opts?.address,
    staleTime: 120_000,
  });
}

export function useNFTs(opts: NFTOpts | null) {
  return useQuery({
    queryKey: indexerQueryKeys.nfts(opts ?? { address: "", chainId: 0 }),
    queryFn: async () => {
      const result = await cachedCall<PaginatedResult<NFTAsset>>(
        "nftMetadata",
        [opts!.address, opts!.chainId, opts!.cursor ?? ""],
        "getNFTs",
        [opts!],
      );
      return result;
    },
    enabled: !!opts?.address,
    staleTime: 60_000,
  });
}

export function useTokenApprovals(
  address: string | undefined,
  chainId: number,
) {
  return useQuery({
    queryKey: indexerQueryKeys.tokenApprovals(address ?? "", chainId),
    queryFn: async () => {
      const result = await cachedCall<TokenApproval[]>(
        "tokenApprovals",
        [address!, chainId],
        "getTokenApprovals",
        [address!, chainId],
      );
      return result;
    },
    enabled: !!address,
    staleTime: 60_000,
  });
}

export function useTokenPrices(addresses: string[], chainId: number) {
  return useQuery({
    queryKey: indexerQueryKeys.tokenPrices(addresses, chainId),
    queryFn: async () => {
      const result = await cachedCall<TokenPrice[]>(
        "prices",
        [addresses.sort().join(","), chainId],
        "getTokenPrices",
        [addresses, chainId],
      );
      return result;
    },
    enabled: addresses.length > 0,
    staleTime: 60_000,
  });
}

export function useENSResolution(
  nameOrAddress: string | undefined,
  chainId: number,
) {
  return useQuery({
    queryKey: indexerQueryKeys.ens(nameOrAddress ?? "", chainId),
    queryFn: async () => {
      const result = await cachedCall<ENSResolution | null>(
        "ensResolution",
        [nameOrAddress!, chainId],
        "resolveENS",
        [nameOrAddress!, chainId],
      );
      return result;
    },
    enabled: !!nameOrAddress,
    staleTime: 86_400_000,
  });
}

/**
 * TanStack Query hook for NFTs with collection grouping.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { indexerRegistry } from "@/services/indexer/registry";
import type { NFTAsset, NFTOpts, PaginatedResult } from "@/services/indexer/types";
import type { NFTCollection } from "@/services/nfts/types";
import { checkNFTSpam } from "@/services/nfts/spamFilter";

export const nftQueryKeys = {
  list: (address: string, chainId: number) =>
    ["nfts", address, chainId] as const,
};

export function useNFTsQuery(
  address: string | undefined,
  chainId: number,
  excludeSpam = true,
) {
  const query = useInfiniteQuery({
    queryKey: nftQueryKeys.list(address ?? "", chainId),
    queryFn: async ({ pageParam }) => {
      const opts: NFTOpts = {
        address: address!,
        chainId,
        cursor: pageParam as string | undefined,
        limit: 20,
        excludeSpam,
      };
      return indexerRegistry.call<PaginatedResult<NFTAsset>>("getNFTs", opts);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.cursor : undefined,
    enabled: !!address,
    staleTime: 60_000,
  });

  // Group by collection
  const collections: NFTCollection[] = [];
  const hiddenNFTs: NFTAsset[] = [];

  if (query.data?.pages) {
    const allNFTs = query.data.pages.flatMap((p) => p.items);
    const collectionMap = new Map<string, NFTAsset[]>();

    for (const nft of allNFTs) {
      const spamResult = checkNFTSpam(nft);
      if (spamResult.isSpam) {
        hiddenNFTs.push(nft);
        continue;
      }

      const key = `${nft.contractAddress}:${nft.chainId}`;
      const items = collectionMap.get(key) ?? [];
      items.push(nft);
      collectionMap.set(key, items);
    }

    for (const [_, items] of collectionMap) {
      const first = items[0];
      collections.push({
        name: first.collection.name,
        slug: first.collection.slug,
        imageUrl: first.collection.imageUrl,
        isVerified: first.collection.isVerified,
        floorPrice: first.collection.floorPrice,
        items,
      });
    }
  }

  return { ...query, collections, hiddenNFTs };
}

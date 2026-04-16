/**
 * TanStack Query hook for token approvals.
 */

import { useQuery } from "@tanstack/react-query";
import { getCached, setCache } from "@/services/indexer/cache";
import { indexerRegistry } from "@/services/indexer/registry";
import type { TokenApproval } from "@/services/indexer/types";

export const approvalsQueryKeys = {
  list: (address: string, chainId: number) =>
    ["tokenApprovals", address, chainId] as const,
};

export function useTokenApprovalsQuery(
  address: string | undefined,
  chainId: number,
) {
  return useQuery({
    queryKey: approvalsQueryKeys.list(address ?? "", chainId),
    queryFn: async (): Promise<TokenApproval[]> => {
      if (!address) return [];

      const cached = getCached<TokenApproval[]>(
        "tokenApprovals",
        address,
        chainId,
      );

      try {
        const approvals = await indexerRegistry.call<TokenApproval[]>(
          "getTokenApprovals",
          address,
          chainId,
        );
        setCache("tokenApprovals", approvals, address, chainId);
        return approvals;
      } catch {
        return cached?.data ?? [];
      }
    },
    enabled: !!address,
    staleTime: 60_000,
  });
}

/**
 * TanStack Query hook for paginated transaction history grouped by day.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import type { DayGroup, HistoryFilter } from "@/services/history/types";
import { indexerRegistry } from "@/services/indexer/registry";
import type {
  HistoryOpts,
  PaginatedResult,
  WalletTransaction,
} from "@/services/indexer/types";

export const historyQueryKeys = {
  list: (address: string, chainId: number, filter?: HistoryFilter) =>
    ["transactionHistory", address, chainId, filter] as const,
};

function groupByDay(transactions: WalletTransaction[]): DayGroup[] {
  const groups = new Map<string, WalletTransaction[]>();
  const now = new Date();
  const today = formatDate(now);
  const yesterday = formatDate(new Date(now.getTime() - 86_400_000));

  for (const tx of transactions) {
    const date = tx.timestamp
      ? formatDate(new Date(tx.timestamp * 1000))
      : "Unknown";
    const existing = groups.get(date) ?? [];
    existing.push(tx);
    groups.set(date, existing);
  }

  return Array.from(groups.entries()).map(([date, txs]) => ({
    date,
    label:
      date === today
        ? "Today"
        : date === yesterday
          ? "Yesterday"
          : formatLabel(date),
    transactions: txs,
  }));
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function useTransactionHistoryQuery(
  address: string | undefined,
  chainId: number,
  filter?: HistoryFilter,
) {
  return useInfiniteQuery({
    queryKey: historyQueryKeys.list(address ?? "", chainId, filter),
    queryFn: async ({ pageParam }) => {
      const opts: HistoryOpts = {
        address: address!,
        chainId,
        cursor: pageParam as string | undefined,
        limit: 25,
        types: filter?.types,
      };

      const result = await indexerRegistry.call<
        PaginatedResult<WalletTransaction>
      >("getTransactionHistory", opts);

      return result;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.cursor : undefined,
    enabled: !!address,
    staleTime: 120_000,
  });
}

export function useDayGroupedHistory(
  address: string | undefined,
  chainId: number,
  filter?: HistoryFilter,
) {
  const query = useTransactionHistoryQuery(address, chainId, filter);

  const dayGroups: DayGroup[] = [];
  if (query.data?.pages) {
    const allTxs = query.data.pages.flatMap((p) => p.items);
    dayGroups.push(...groupByDay(allTxs));
  }

  return {
    ...query,
    dayGroups,
  };
}

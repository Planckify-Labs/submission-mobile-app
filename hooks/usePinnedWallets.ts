import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { storage } from "@/lib/storage/mmkv";

const STORAGE_KEY = "pinned_wallet_addresses";
const QUERY_KEY = ["pinnedWalletAddresses"];
const MAX_PINNED = 3;

function readFromStorage(): string[] {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((a): a is string => typeof a === "string")
      : [];
  } catch {
    return [];
  }
}

function writeToStorage(addresses: string[]) {
  storage.set(STORAGE_KEY, JSON.stringify(addresses));
}

export type TogglePinResult = {
  pinned: boolean;
  limitReached?: boolean;
};

export function usePinnedWallets() {
  const queryClient = useQueryClient();

  const { data: pinnedAddresses = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: readFromStorage,
    // MMKV is sync — seed initialData so the horizontal strip renders
    // pinned wallets on frame 0 without a flash of "first 3" fallback.
    initialData: readFromStorage,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const isPinned = useCallback(
    (address: string) => pinnedAddresses.includes(address),
    [pinnedAddresses],
  );

  const togglePin = useCallback(
    (address: string): TogglePinResult => {
      const already = pinnedAddresses.includes(address);
      if (already) {
        const next = pinnedAddresses.filter((a) => a !== address);
        writeToStorage(next);
        queryClient.setQueryData(QUERY_KEY, next);
        return { pinned: false };
      }
      if (pinnedAddresses.length >= MAX_PINNED) {
        return { pinned: false, limitReached: true };
      }
      const next = [...pinnedAddresses, address];
      writeToStorage(next);
      queryClient.setQueryData(QUERY_KEY, next);
      return { pinned: true };
    },
    [pinnedAddresses, queryClient],
  );

  return {
    pinnedAddresses,
    isPinned,
    togglePin,
    canPinMore: pinnedAddresses.length < MAX_PINNED,
    maxPinned: MAX_PINNED,
  };
}

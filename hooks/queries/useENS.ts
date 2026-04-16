/**
 * TanStack Query hooks for ENS resolution.
 */

import { useQuery } from "@tanstack/react-query";
import {
  resolveAvatar,
  resolveForward,
  resolveReverse,
} from "@/services/ens/resolver";
import {
  isUnstoppableDomain,
  resolveUnstoppable,
} from "@/services/ens/unstoppable";

export const ensQueryKeys = {
  name: (address: string) => ["ens", "name", address] as const,
  address: (name: string) => ["ens", "address", name] as const,
  avatar: (name: string) => ["ens", "avatar", name] as const,
};

export function useENSName(address: string | undefined) {
  return useQuery({
    queryKey: ensQueryKeys.name(address ?? ""),
    queryFn: async () => {
      if (!address) return null;
      const result = await resolveReverse(address);
      return result?.name ?? null;
    },
    enabled: !!address,
    staleTime: 86_400_000, // 24h
  });
}

export function useENSAddress(name: string | undefined) {
  return useQuery({
    queryKey: ensQueryKeys.address(name ?? ""),
    queryFn: async () => {
      if (!name) return null;

      // Try Unstoppable Domains first for non-.eth names
      if (isUnstoppableDomain(name)) {
        const udResult = await resolveUnstoppable(name);
        if (udResult?.address) return udResult.address;
      }

      // Then try ENS
      const result = await resolveForward(name);
      return result?.address ?? null;
    },
    enabled: !!name && name.includes("."),
    staleTime: 86_400_000,
  });
}

export function useENSAvatar(name: string | undefined) {
  return useQuery({
    queryKey: ensQueryKeys.avatar(name ?? ""),
    queryFn: async () => {
      if (!name) return null;
      return resolveAvatar(name);
    },
    enabled: !!name,
    staleTime: 86_400_000,
  });
}

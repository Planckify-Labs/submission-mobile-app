import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addressBookApi } from "@/api/endpoints/addressBook";
import type { TCreateAddressBookDto, TUpdateAddressBookDto } from "@/api/types/addressBook";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";
import { addressBookQueryKeys } from "@/constants/queryKeys/addressBookQueryKeys";
import { useIsAuthenticated } from "@/hooks/queries/useAuth";
import { storage } from "@/lib/storage/mmkv";

const MMKV_KEY = "cached_address_book";
const MMKV_TIMESTAMP_KEY = "cached_address_book_timestamp";
const STALE_TIME = 5 * 60 * 1000;    // 5 min — after this, fetch from API on next mount
const OFFLINE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h — gcTime / offline fallback window

export function useAddressBook() {
  const [search, setSearch] = useState("");
  const { isAuthenticated, isLoading: isAuthLoading } = useIsAuthenticated();
  const queryClient = useQueryClient();

  const {
    data: allContacts = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: addressBookQueryKeys.list(),
    queryFn: async () => {
      const cachedRaw = storage.getString(MMKV_KEY);
      const timestampStr = storage.getString(MMKV_TIMESTAMP_KEY);
      const now = Date.now();
      const timestamp = timestampStr ? parseInt(timestampStr, 10) : 0;

      // Fast path: MMKV cache is still fresh — skip network call entirely
      if (cachedRaw && now - timestamp < STALE_TIME) {
        return JSON.parse(cachedRaw) as TAddressBookEntry[];
      }

      // Cache is stale or missing — fetch from API and refresh MMKV
      try {
        const response = await addressBookApi.getAll();
        storage.set(MMKV_KEY, JSON.stringify(response));
        storage.set(MMKV_TIMESTAMP_KEY, now.toString());
        return response;
      } catch (error) {
        // Offline fallback: serve any MMKV data available, regardless of age
        if (cachedRaw) {
          return JSON.parse(cachedRaw) as TAddressBookEntry[];
        }
        throw error;
      }
    },
    staleTime: STALE_TIME,
    gcTime: OFFLINE_CACHE_TTL,
    enabled: isAuthenticated === true && !isAuthLoading,
    refetchOnMount: true,
    retry: false,
  });

  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...allContacts].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.ensName?.toLowerCase().includes(q) ?? false),
    );
  }, [allContacts, search]);

  // Optimistically insert the new contact so it appears in the list immediately.
  // A temporary ID is used until the server responds with the real one.
  // On error the snapshot is restored; on settle the real data replaces the temp entry.
  const addMutation = useMutation({
    mutationFn: (dto: TCreateAddressBookDto) => addressBookApi.create(dto),
    onMutate: async (dto) => {
      await queryClient.cancelQueries({ queryKey: addressBookQueryKeys.list() });

      const previousContacts = queryClient.getQueryData<TAddressBookEntry[]>(
        addressBookQueryKeys.list(),
      );

      const optimisticEntry: TAddressBookEntry = {
        id: `optimistic-${Date.now()}`,
        label: dto.label,
        address: dto.address,
        ensName: dto.ensName ?? null,
        notes: dto.notes ?? null,
        chainName: dto.chainName ?? null,
        isEvm: dto.isEvm ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<TAddressBookEntry[]>(
        addressBookQueryKeys.list(),
        (current) => [...(current ?? []), optimisticEntry],
      );

      return { previousContacts };
    },
    onError: (_err, _dto, context) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(
          addressBookQueryKeys.list(),
          context.previousContacts,
        );
      }
    },
    onSettled: () => {
      // Bust MMKV timestamp so the next queryFn call fetches fresh data from API
      storage.remove(MMKV_TIMESTAMP_KEY);
      queryClient.invalidateQueries({ queryKey: addressBookQueryKeys.list() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: TUpdateAddressBookDto }) =>
      addressBookApi.update(id, dto),
    onSuccess: (_data, { id }) => {
      storage.remove(MMKV_TIMESTAMP_KEY);
      queryClient.invalidateQueries({ queryKey: addressBookQueryKeys.list() });
      queryClient.invalidateQueries({ queryKey: addressBookQueryKeys.detail(id) });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => addressBookApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: addressBookQueryKeys.list() });

      const previousContacts = queryClient.getQueryData<TAddressBookEntry[]>(
        addressBookQueryKeys.list(),
      );

      queryClient.setQueryData<TAddressBookEntry[]>(
        addressBookQueryKeys.list(),
        (current) => current?.filter((c) => c.id !== id) ?? [],
      );

      return { previousContacts };
    },
    onError: (_err, _id, context) => {
      if (context?.previousContacts) {
        queryClient.setQueryData(
          addressBookQueryKeys.list(),
          context.previousContacts,
        );
      }
    },
    onSettled: () => {
      // Bust MMKV timestamp so the next queryFn call fetches fresh data from API
      storage.remove(MMKV_TIMESTAMP_KEY);
      queryClient.invalidateQueries({ queryKey: addressBookQueryKeys.list() });
    },
  });

  return {
    contacts,
    allContacts,
    isLoading: isLoading || isAuthLoading,
    isRefetching,
    isError,
    search,
    setSearch,
    refetch,
    add: (dto: TCreateAddressBookDto) => addMutation.mutateAsync(dto),
    update: (id: string, dto: TUpdateAddressBookDto) =>
      updateMutation.mutateAsync({ id, dto }),
    remove: (id: string) => removeMutation.mutate(id),
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    addError: addMutation.error,
  };
}

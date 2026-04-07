import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addressBookApi } from "@/api/endpoints/addressBook";
import type { TCreateAddressBookDto, TUpdateAddressBookDto } from "@/api/types/addressBook";
import type { TAddressBookEntry } from "@/constants/types/addressBookTypes";
import { addressBookQueryKeys } from "@/constants/queryKeys/addressBookQueryKeys";
import { useIsAuthenticated } from "@/hooks/queries/useAuth";

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
    queryFn: () => addressBookApi.getAll(),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    enabled: isAuthenticated === true && !isAuthLoading,
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
      queryClient.invalidateQueries({ queryKey: addressBookQueryKeys.list() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: TUpdateAddressBookDto }) =>
      addressBookApi.update(id, dto),
    onSuccess: (_data, { id }) => {
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

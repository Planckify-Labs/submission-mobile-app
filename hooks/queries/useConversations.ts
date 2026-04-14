import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationSummary } from "@/api/conversations.types";
import { conversationsApi } from "@/api/endpoints/conversationsApi";
import { chatConvKey, chatListKey } from "@/lib/storage/chatKeys";
import { storage } from "@/lib/storage/mmkv";

// ── MMKV types ────────────────────────────────────────────────────────────────

export interface ConversationListCache {
  items: ConversationSummary[];
  next_cursor: string | null;
  cached_at: number;
}

export interface StoredMessage {
  role: "user" | "assistant" | "tool";
  content: string; // plain text for display
  raw: unknown; // full ModelMessage for sending back to agent
  created_at: string;
}

export interface ConversationCache {
  id: string;
  title: string;
  messages: StoredMessage[];
  cached_at: number;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useConversationList(walletAddress: string | undefined) {
  return useQuery({
    queryKey: ["conversations", walletAddress],
    queryFn: () => conversationsApi.list(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000,
    placeholderData: () => {
      if (!walletAddress) return undefined;
      const cached = storage.getString(chatListKey(walletAddress));
      if (!cached) return undefined;
      return JSON.parse(cached) as ConversationListCache;
    },
  });
}

export function useConversation(
  id: string | null,
  walletAddress: string | undefined,
) {
  return useQuery({
    queryKey: ["conversations", id, walletAddress],
    queryFn: () => conversationsApi.get(id!, walletAddress!),
    enabled: !!id && !!walletAddress,
    staleTime: 5 * 60 * 1000,
    placeholderData: () => {
      if (!id || !walletAddress) return undefined;
      const cached = storage.getString(chatConvKey(walletAddress, id));
      if (!cached) return undefined;
      // ConversationCache is used as optimistic placeholder — shape differs
      // slightly from ConversationDetailResponse but satisfies the display contract
      return JSON.parse(
        cached,
      ) as unknown as import("@/api/conversations.types").ConversationDetailResponse;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      walletAddress,
    }: {
      id: string;
      walletAddress: string;
    }) => conversationsApi.delete(id, walletAddress),

    onMutate: async ({ id, walletAddress }) => {
      await queryClient.cancelQueries({
        queryKey: ["conversations", walletAddress],
      });
      const previous = queryClient.getQueryData<ConversationListCache>([
        "conversations",
        walletAddress,
      ]);

      // Optimistically remove from React Query cache
      queryClient.setQueryData<ConversationListCache>(
        ["conversations", walletAddress],
        (old) =>
          old ? { ...old, items: old.items.filter((c) => c.id !== id) } : old,
      );

      // Optimistically remove from MMKV
      const mmkvKey = chatListKey(walletAddress);
      const cached = storage.getString(mmkvKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ConversationListCache;
        parsed.items = parsed.items.filter((c) => c.id !== id);
        storage.set(mmkvKey, JSON.stringify(parsed));
      }
      storage.remove(chatConvKey(walletAddress, id));

      return { previous };
    },

    onError: (_err, { walletAddress }, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["conversations", walletAddress],
          ctx.previous,
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["conversations", walletAddress],
      });
    },

    onSettled: (_data, _err, { walletAddress }) => {
      queryClient.invalidateQueries({
        queryKey: ["conversations", walletAddress],
      });
    },
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      walletAddress,
      title,
    }: {
      id: string;
      walletAddress: string;
      title: string;
    }) => conversationsApi.rename(id, walletAddress, title),

    onMutate: async ({ id, walletAddress, title }) => {
      await queryClient.cancelQueries({
        queryKey: ["conversations", walletAddress],
      });
      const previous = queryClient.getQueryData<ConversationListCache>([
        "conversations",
        walletAddress,
      ]);

      // Optimistically update title in React Query cache
      queryClient.setQueryData<ConversationListCache>(
        ["conversations", walletAddress],
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((c) =>
                  c.id === id ? { ...c, title } : c,
                ),
              }
            : old,
      );

      // Optimistically update MMKV list cache
      const listKey = chatListKey(walletAddress);
      const listRaw = storage.getString(listKey);
      if (listRaw) {
        const list = JSON.parse(listRaw) as ConversationListCache;
        list.items = list.items.map((c) => (c.id === id ? { ...c, title } : c));
        storage.set(listKey, JSON.stringify(list));
      }

      // Optimistically update MMKV conversation cache
      const convKey = chatConvKey(walletAddress, id);
      const convRaw = storage.getString(convKey);
      if (convRaw) {
        const conv = JSON.parse(convRaw) as ConversationCache;
        conv.title = title;
        storage.set(convKey, JSON.stringify(conv));
      }

      return { previous };
    },

    onError: (_err, { walletAddress }, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["conversations", walletAddress],
          ctx.previous,
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["conversations", walletAddress],
      });
    },

    onSettled: (_data, _err, { walletAddress }) => {
      queryClient.invalidateQueries({
        queryKey: ["conversations", walletAddress],
      });
    },
  });
}

import type {
  ConversationDetailResponse,
  ConversationListResponse,
} from "../conversations.types";

function resolveBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_AI_API_URL;
  if (!raw) throw new Error("EXPO_PUBLIC_AI_API_URL is not set");
  return raw.replace(/\/$/, "");
}

function resolveApiKey(): string {
  return process.env.EXPO_PUBLIC_SECRET_AI_KEY ?? "";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${resolveBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": resolveApiKey(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // Keep raw status/body out of the Error message — it bubbles up
    // through React Query and could land in `error.message` UI.
    const text = await res.text().catch(() => "");
    if (__DEV__) {
      console.warn(
        "[conversationsApi] request failed",
        res.status,
        res.statusText,
        text,
      );
    }
    throw new Error("Conversations request failed");
  }

  return res.json() as Promise<T>;
}

export const conversationsApi = {
  list(
    walletAddress: string,
    cursor?: string,
  ): Promise<ConversationListResponse> {
    const params = new URLSearchParams({ wallet_address: walletAddress });
    if (cursor) params.set("cursor", cursor);
    return apiFetch<ConversationListResponse>(
      `/conversations?${params.toString()}`,
    );
  },

  get(id: string, walletAddress: string): Promise<ConversationDetailResponse> {
    const params = new URLSearchParams({ wallet_address: walletAddress });
    return apiFetch<ConversationDetailResponse>(
      `/conversations/${id}?${params.toString()}`,
    );
  },

  async delete(id: string, walletAddress: string): Promise<void> {
    const url = `${resolveBaseUrl()}/conversations/${id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": resolveApiKey(),
      },
      body: JSON.stringify({ wallet_address: walletAddress }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (__DEV__) {
        console.warn(
          "[conversationsApi] delete failed",
          res.status,
          res.statusText,
          text,
        );
      }
      throw new Error("Conversation delete failed");
    }
  },

  rename(
    id: string,
    walletAddress: string,
    title: string,
  ): Promise<{ id: string; title: string }> {
    return apiFetch<{ id: string; title: string }>(
      `/conversations/${id}/title`,
      {
        method: "PATCH",
        body: JSON.stringify({ wallet_address: walletAddress, title }),
      },
    );
  },
};

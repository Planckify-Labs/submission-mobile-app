/**
 * Session-scoped "last active conversation per wallet" pointer.
 *
 * Lives in a module-level Map — process memory only, never persisted.
 * This is deliberate: toggling between wallets within one app session
 * should feel like switching tabs (each wallet keeps its current
 * thread), but a cold start must NOT silently resurrect the previous
 * session's chat. On app launch this Map is empty, so
 * `AgentMode`'s wallet-change hydration finds nothing and the user
 * sees a fresh thread until they pick a conversation from the
 * history panel.
 *
 * Key is the lowercased wallet address; the MMKV list / cache keys
 * use the same normalization (see `lib/storage/chatKeys.ts`).
 */

const byWallet = new Map<string, string>();

function normalize(address: string): string {
  return address.toLowerCase();
}

export const activeConvRegistry = {
  get(walletAddress: string): string | undefined {
    return byWallet.get(normalize(walletAddress));
  },

  set(walletAddress: string, conversationId: string): void {
    byWallet.set(normalize(walletAddress), conversationId);
  },

  clear(walletAddress: string): void {
    byWallet.delete(normalize(walletAddress));
  },

  clearAll(): void {
    byWallet.clear();
  },
};

export const __testing = {
  reset(): void {
    byWallet.clear();
  },
  size(): number {
    return byWallet.size;
  },
};

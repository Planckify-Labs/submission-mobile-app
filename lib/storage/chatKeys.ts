export function chatListKey(walletAddress: string): string {
  return `chat:list:${walletAddress.toLowerCase()}`;
}

export function chatConvKey(walletAddress: string, convId: string): string {
  return `chat:conv:${walletAddress.toLowerCase()}:${convId}`;
}

export function chatPrefixForWallet(walletAddress: string): string[] {
  const addr = walletAddress.toLowerCase();
  // The `chat:active:*` prefix is legacy — the active-conversation
  // pointer is now in-memory only (see `services/activeConvRegistry`).
  // Kept in this list so the logout sweep still tidies up any keys
  // left behind by older app builds that did persist it.
  return [`chat:list:${addr}`, `chat:active:${addr}`, `chat:conv:${addr}:`];
}

/**
 * Delete every `chat:*` MMKV entry scoped to the given wallet. Used
 * by the logout path to make sure the next user on the same device
 * cannot read the previous user's agent conversations.
 */
export function clearChatStateForWallet(
  storage: { getAllKeys: () => string[]; remove: (key: string) => void },
  walletAddress: string,
): void {
  const addr = walletAddress.toLowerCase();
  const prefixes = [
    `chat:list:${addr}`,
    `chat:active:${addr}`,
    `chat:conv:${addr}:`,
  ];
  for (const key of storage.getAllKeys()) {
    if (
      prefixes.some((p) => (p.endsWith(":") ? key.startsWith(p) : key === p))
    ) {
      storage.remove(key);
    }
  }
}

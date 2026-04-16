import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "dapp_bridge.user_chains";

export interface UserChain {
  chainId: number;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  /**
   * TWV-2026-049 — `"verified"` when every stored `blockExplorerUrls`
   * entry matches the pinned allowlist for this chainId. `"unverified"`
   * otherwise — consumer UI MUST require long-press + in-app WebView
   * when rendering an unverified explorer link.
   */
  explorerTrust?: "verified" | "unverified";
  iconUrls?: string[];
  addedAt: number;
  /** Best-effort capability flags filled during add-chain health check. */
  supportsTypes?: { t0?: boolean; t1?: boolean; t2?: boolean };
}

let chains: Record<number, UserChain> = {};
let hydrated = false;
const listeners = new Set<() => void>();

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) chains = JSON.parse(raw) as Record<number, UserChain>;
  } catch {
    chains = {};
  }
}

async function persist(): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(chains));
  } catch {
    // best effort
  }
}

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // swallow
    }
  }
}

// TWV-2026-016 — signing-chainId invariant lives in
// `./signingChainId.ts` (kept dep-free so it's unit-testable under plain
// Node). Re-export for back-compat and grep proximity to chainStore.
export { getSigningChainId, verifyRpcChainId } from "./signingChainId";

export const UserChainStore = {
  hydrate,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get(chainId: number): UserChain | null {
    return chains[chainId] ?? null;
  },
  has(chainId: number): boolean {
    return chainId in chains;
  },
  list(): UserChain[] {
    return Object.values(chains);
  },
  async add(chain: UserChain): Promise<void> {
    await hydrate();
    chains[chain.chainId] = chain;
    await persist();
    notify();
  },
  async remove(chainId: number): Promise<void> {
    await hydrate();
    if (!chains[chainId]) return;
    delete chains[chainId];
    await persist();
    notify();
  },
};

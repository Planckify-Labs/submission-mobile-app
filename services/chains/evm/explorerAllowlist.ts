// TWV-2026-049 — Per-chain explorer-host allowlist. `wallet_addEthereumChain`
// accepts an attacker-supplied `blockExplorerUrls`; if the wallet stores
// and renders it without validation, "View on Explorer" links in tx
// history send users to phishing pages.
//
// The allowlist below is a curated projection of chainid.network +
// internal overrides for the chains shipped in the default registry.
// Extending it requires a second reviewer.

export interface ExplorerAllowlistEntry {
  chainId: number;
  hosts: readonly string[];
}

export const EXPLORER_ALLOWLIST: readonly ExplorerAllowlistEntry[] = [
  { chainId: 1, hosts: ["etherscan.io"] },
  { chainId: 10, hosts: ["optimistic.etherscan.io", "explorer.optimism.io"] },
  { chainId: 56, hosts: ["bscscan.com"] },
  { chainId: 100, hosts: ["gnosisscan.io", "blockscout.com"] },
  { chainId: 137, hosts: ["polygonscan.com"] },
  { chainId: 250, hosts: ["ftmscan.com"] },
  { chainId: 8453, hosts: ["basescan.org", "base.blockscout.com"] },
  { chainId: 42161, hosts: ["arbiscan.io"] },
  { chainId: 43114, hosts: ["snowtrace.io"] },
  { chainId: 59144, hosts: ["lineascan.build"] },
  { chainId: 534352, hosts: ["scrollscan.com"] },
  { chainId: 7777777, hosts: ["explorer.zora.energy"] },
  { chainId: 81457, hosts: ["blastscan.io"] },
];

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isExplorerAllowed(chainId: number, url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const entry = EXPLORER_ALLOWLIST.find((e) => e.chainId === chainId);
  if (!entry) return false;
  return entry.hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

export interface ExplorerValidation {
  status: "verified" | "unverified";
  url: string;
  host: string | null;
  reason?: string;
}

export function validateBlockExplorerUrls(
  chainId: number,
  urls: readonly string[] | undefined,
): ExplorerValidation[] {
  if (!urls) return [];
  return urls.map((url) => {
    const host = hostOf(url);
    if (!host) {
      return {
        status: "unverified",
        url,
        host: null,
        reason: "non-https URL or malformed",
      };
    }
    if (isExplorerAllowed(chainId, url)) {
      return { status: "verified", url, host };
    }
    return {
      status: "unverified",
      url,
      host,
      reason: `host ${host} not on chainid.network allowlist for chainId ${chainId}`,
    };
  });
}

/**
 * Sanitise a dApp-supplied short string (e.g. `nativeCurrency.name`)
 * before persisting or rendering it. Strips control chars; clips
 * length. NEVER feed the return value into HTML — always into a React
 * Native `<Text>` node.
 */
export function sanitiseChainString(s: unknown, maxLen = 64): string {
  if (typeof s !== "string") return "";
  // Control chars + zero-width characters that spoof homoglyph attacks.
  const stripped = s
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, "");
  return stripped.slice(0, maxLen).trim();
}

/**
 * Sanitise an `iconUrls` entry — only https and same-scheme; strip any
 * javascript:/data:/file:/vbscript: vectors. Returns null on reject.
 */
export function sanitiseIconUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type TokenSource =
  | "default-list"
  | "user-added"
  | "auto-discovered"
  | "dapp-watch-asset";

export interface TokenInfo {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

export interface TokenBalanceItem {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  price?: number;
  change24h?: number;
  logoURI?: string;
  chainId: number;
  namespace: string;
  isSpam: boolean;
  spamReason?: string;
  source: TokenSource;
  isPinned: boolean;
  isHidden: boolean;
}

export interface GroupedTokenBalances {
  main: TokenBalanceItem[];
  discovered: TokenBalanceItem[];
  hidden: TokenBalanceItem[];
}

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  severity: "safe" | "warn" | "danger";
}

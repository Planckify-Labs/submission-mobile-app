export type {
  WalletTransaction,
  TxStatus,
  TxType,
  TokenTransfer,
  NFTTransfer,
} from "@/services/indexer/types";

export interface DayGroup {
  date: string; // YYYY-MM-DD
  label: string; // "Today", "Yesterday", "Mar 15, 2026"
  transactions: import("@/services/indexer/types").WalletTransaction[];
}

export interface HistoryFilter {
  chainId?: number;
  types?: import("@/services/indexer/types").TxType[];
  tokenAddress?: string;
}

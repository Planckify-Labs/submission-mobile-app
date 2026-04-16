/**
 * IndexerProvider interface and shared types.
 * All downstream features (balances, history, NFTs, approvals, ENS)
 * import from here — never from a vendor-specific module.
 */

// ─── Enums & Literals ────────────────────────────────────────────────

export type TokenSource =
  | "default-list"
  | "user-added"
  | "auto-discovered"
  | "dapp-watch-asset";

export type TxStatus =
  | "confirmed"
  | "pending"
  | "failed"
  | "dropped"
  | "replaced";

export type TxType =
  | "native-transfer"
  | "token-transfer"
  | "token-approve"
  | "nft-transfer"
  | "swap"
  | "contract-interaction"
  | "contract-deploy"
  | "bridge"
  | "unknown";

// ─── Data Types ──────────────────────────────────────────────────────

export interface TokenBalance {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  price?: number;
  logoURI?: string;
  chainId: number;
  namespace: string;
  isSpam: boolean;
  source: TokenSource;
}

export interface TokenPrice {
  contractAddress: string;
  chainId: number;
  priceUsd: number;
  change24h: number;
  updatedAt: number;
}

export interface TokenApproval {
  contractAddress: string;
  spender: string;
  spenderLabel?: string;
  allowance: bigint | "unlimited";
  tokenType: "ERC-20" | "ERC-721" | "ERC-1155";
  isApprovalForAll: boolean;
  chainId: number;
  lastUpdatedBlock: number;
}

export interface NFTAsset {
  contractAddress: string;
  tokenId: string;
  tokenType: "ERC-721" | "ERC-1155";
  balance: number;
  chainId: number;
  isSpam: boolean;
  collection: {
    name: string;
    slug?: string;
    imageUrl?: string;
    isVerified: boolean;
    floorPrice?: number;
  };
  metadata: {
    name: string;
    description?: string;
    imageUrl?: string;
    animationUrl?: string;
    attributes: NFTAttribute[];
  };
}

export interface NFTAttribute {
  traitType: string;
  value: string | number;
  displayType?: string;
}

export interface ENSResolution {
  name: string | null;
  address: string | null;
  avatar?: string;
  textRecords?: Record<string, string>;
  contenthash?: string;
  chainId: number;
}

export interface WalletTransaction {
  hash: string;
  chainId: number;
  namespace: string;
  status: TxStatus;
  from: string;
  to: string | null;
  value: bigint;
  type: TxType;
  decoded: {
    functionName?: string;
    args?: unknown[];
    tokenTransfers: TokenTransfer[];
    nftTransfers: NFTTransfer[];
  };
  fee: {
    gasUsed?: bigint;
    effectiveGasPrice?: bigint;
    feeUsd?: number;
  };
  blockNumber?: number;
  timestamp?: number;
  nonce: number;
  replacedBy?: string;
  replacementFor?: string;
}

export interface TokenTransfer {
  contractAddress: string;
  from: string;
  to: string;
  value: bigint;
  symbol?: string;
  decimals?: number;
}

export interface NFTTransfer {
  contractAddress: string;
  from: string;
  to: string;
  tokenId: string;
  amount: number;
  tokenType: "ERC-721" | "ERC-1155";
}

// ─── Query Options ───────────────────────────────────────────────────

export interface HistoryOpts {
  address: string;
  chainId: number;
  cursor?: string;
  limit?: number;
  types?: TxType[];
}

export interface NFTOpts {
  address: string;
  chainId: number;
  cursor?: string;
  limit?: number;
  excludeSpam?: boolean;
}

// ─── Provider Results ────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

// ─── Provider Interface ──────────────────────────────────────────────

export interface IndexerProvider {
  readonly name: string;
  readonly priority: number;

  getTokenBalances(address: string, chainId: number): Promise<TokenBalance[]>;

  getTransactionHistory(
    opts: HistoryOpts,
  ): Promise<PaginatedResult<WalletTransaction>>;

  getNFTs(opts: NFTOpts): Promise<PaginatedResult<NFTAsset>>;

  getTokenApprovals(address: string, chainId: number): Promise<TokenApproval[]>;

  getTokenMetadata(
    contractAddress: string,
    chainId: number,
  ): Promise<{
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  } | null>;

  getTokenPrices(
    contractAddresses: string[],
    chainId: number,
  ): Promise<TokenPrice[]>;

  resolveENS(
    nameOrAddress: string,
    chainId: number,
  ): Promise<ENSResolution | null>;
}

// ─── Errors ──────────────────────────────────────────────────────────

export class IndexerNotSupportedError extends Error {
  constructor(method: string, provider: string) {
    super(`${method} is not supported by ${provider}`);
    this.name = "IndexerNotSupportedError";
  }
}

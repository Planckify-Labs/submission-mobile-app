export interface TToken {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  blockchainId: string;
  contractAddress: string;
  logoUrl: string;
  isStablecoin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isNativeCurrency: boolean;
  peggedCurrency?: string | null;
}

export type TokenListResponse = TToken[];

export interface TTokenSearchParams {
  symbol?: string;
  name?: string;
  blockchainId?: string;
  contractAddress?: string;
  isStablecoin?: boolean;
  isActive?: boolean;
  take?: number;
  cursor?: string;
  isNativeCurrency?: boolean;
}

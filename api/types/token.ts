export interface TToken {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  blockchainId: string;
  contractAddress: string | null;
  logoUrl: string | null;
  isStablecoin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isNativeCurrency: boolean;
  peggedCurrency?: string | null;
  isPaymentEnabled?: boolean;
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
  isPaymentEnabled?: boolean;
}

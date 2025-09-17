export interface TTakumiTransaction {
  walletAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  bookingId: string;
  exchangeRateId: bigint;
  productVariantId: string;
  timestamp: bigint;
  refId: string;
}

export interface TCreateTransactionParams {
  bookingId: string;
  exchangeRateId: bigint;
  productVariantId: string;
  tokenAddress: `0x${string}`;
  refId: string;
}

export interface TGetTransactionsByAddressParams {
  user: `0x${string}`;
  offset: bigint;
  limit: bigint;
}

export interface TGetTransactionsInRangeParams {
  start: bigint;
  end: bigint;
  offset: bigint;
  limit: bigint;
}

export interface TGetUserTransactionsParams {
  offset: bigint;
  limit: bigint;
}

export interface TTakumiWalletEvents {
  AdminAdded: {
    admin: `0x${string}`;
  };
  AdminRemoved: {
    admin: `0x${string}`;
  };
  TransactionCreated: {
    txId: bigint;
    walletAddress: `0x${string}`;
    tokenAddress: `0x${string}`;
    bookingId: string;
    exchangeRateId: bigint;
    productVariantId: string;
    timestamp: bigint;
    refId: string;
  };
}

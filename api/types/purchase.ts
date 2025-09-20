export type TPurchaseCreateRequest = {
  refId: string;
  walletAddress: string;
  bookingId: string;
  contractAddress: string;
  networkId: string;
  transactionHash: string;
};

export type TVendorResponse = {
  code: number;
  data: {
    trx_code: string;
    selling_total: number;
    transaction_status: "PENDING" | "SUCCESS" | "FAILED";
  };
  status: "SUCCESS" | "FAILED";
  rc_code: string;
};

export type TProduct = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  code: string;
  categoryId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TProductVariant = {
  id: string;
  name: string;
  description: string;
  sku: string;
  productId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subCategoryId: string | null;
  product: TProduct;
};

export type TTransaction = {
  id: string;
  userId: string;
  tokenId: string;
  type: "PAYMENT" | "DEPOSIT" | "WITHDRAWAL";
  status: "PENDING" | "CONFIRMED" | "FAILED";
  amount: string;
  amountInFiat: string;
  fiatCurrency: string;
  txHash: string;
  senderAddress: string;
  recipientAddress: string;
  createdAt: string;
  updatedAt: string;
};

export type TPurchaseCompleted = {
  id: string;
  transactionId: string;
  productVariantId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  vendorResponse: TVendorResponse;
  vendorRefId: string;
  refId: string;
  createdAt: string;
  updatedAt: string;
  transaction: TTransaction;
  productVariant: TProductVariant;
};

export type TPurchaseInitialResponse = {
  refId: string;
  status: "PENDING";
  message: string;
  processingStatus: "queued" | "processing" | "completed" | "failed";
  jobId: string;
  bookingId: string;
  estimatedProcessingTime: string;
};

export type TPurchaseResponse = TPurchaseInitialResponse | TPurchaseCompleted;

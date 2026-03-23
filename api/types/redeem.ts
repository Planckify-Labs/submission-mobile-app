export type TRedeemExecuteRequest = {
  productVariantId: string;
  productPriceId: string;
  customerInfo: { [key: string]: string } | Array<{ key: string; value: string }>;
};

export type TRedeemExecuteResponse = {
  id: string;
  status: "PENDING";
  pointsSpent: string;
  message: string;
};

export type TRedemptionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type TRedemptionStatusResponse = {
  id: string;
  status: TRedemptionStatus;
  pointsSpent: string;
  vendorRefId?: string;
  createdAt: string;
};

export type TRedemptionHistoryItem = {
  id: string;
  status: TRedemptionStatus;
  pointsSpent: string;
  vendorRefId?: string;
  product: {
    id: string;
    name: string;
    variant: {
      id: string;
      name: string;
    };
    price: {
      amount: number;
      currency: string;
    };
  };
  createdAt: string;
  updatedAt: string;
};

export type TRedemptionHistoryResponse = {
  data: TRedemptionHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type TRedemptionHistoryParams = {
  limit?: number;
  cursor?: string;
  status?: TRedemptionStatus;
};

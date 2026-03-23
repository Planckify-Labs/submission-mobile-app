export const redeemQueryKeys = {
  all: ["redeem"] as const,
  status: (id: string) => ["redeem", "status", id] as const,
  history: (params?: object) => ["redeem", "history", params] as const,
};

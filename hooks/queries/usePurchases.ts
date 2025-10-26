import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseApi } from "@/api/endpoints/purchases";
import type { TPurchaseCreateRequest } from "@/api/types/purchase";
import { transactionsQueryKeys } from "@/constants/queryKeys/transactionsQueryKeys";

export const usePurchaseById = (purchaseId: string | undefined) => {
  return useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: async () => {
      if (!purchaseId) throw new Error("Purchase ID is required");
      try {
        const response = await purchaseApi.getPurchaseById(purchaseId);
        console.log("Raw API Response (Get Purchase):", response);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    enabled: !!purchaseId,
  });
};

export const useCreatePurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TPurchaseCreateRequest) => {
      try {
        const response = await purchaseApi.createPurchase(data);
        console.log("Raw API Response (Create Purchase):", response);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: transactionsQueryKeys.all,
        exact: false,
      });
    },
  });
};

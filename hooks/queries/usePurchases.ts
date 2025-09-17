import { purchaseApi } from "@/api/endpoints/purchases";
import type { TPurchaseCreateRequest } from "@/api/types/purchase";
import { useMutation } from "@tanstack/react-query";

export const useCreatePurchase = () => {
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
  });
};

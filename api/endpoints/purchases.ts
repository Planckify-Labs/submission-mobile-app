import { api } from "@/constants/configs/ky";
import type {
  TPurchaseCreateRequest,
  TPurchaseResponse,
  TPurchaseCompleted,
} from "../types/purchase";

export const purchaseApi = {
  createPurchase: async (data: TPurchaseCreateRequest) => {
    try {
      const response = await api
        .post("purchases", { json: data })
        .json<TPurchaseResponse>();
      return response;
    } catch (error) {
      console.error("Failed to create purchase:", error);
      throw error;
    }
  },

  getPurchaseByRefId: async (refId: string) => {
    try {
      const response = await api
        .get(`purchases/${refId}`)
        .json<TPurchaseCompleted>();
      return response;
    } catch (error) {
      console.error("Failed to fetch purchase:", error);
      throw error;
    }
  },

  getPurchasesByWallet: async (walletAddress: string) => {
    try {
      const response = await api
        .get(`purchases/wallet/${walletAddress}`)
        .json<TPurchaseCompleted[]>();
      return response;
    } catch (error) {
      console.error("Failed to fetch purchases for wallet:", error);
      throw error;
    }
  },

  getPurchaseStatus: async (refId: string) => {
    try {
      const response = await api
        .get(`purchases/${refId}/status`)
        .json<{ status: string; processingStatus?: string }>();
      return response;
    } catch (error) {
      console.error("Failed to fetch purchase status:", error);
      throw error;
    }
  },
};

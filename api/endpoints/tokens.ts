import type { TokenListResponse, TTokenSearchParams } from "@/api/types/token";
import { api } from "@/constants/configs/ky";

export const tokenApi = {
  getTokenList: async () => {
    try {
      const response = await api.get("tokens").json<TokenListResponse>();
      return response;
    } catch (error) {
      console.error("Failed to fetch token list:", error);
      throw error;
    }
  },
  searchTokens: async (params?: TTokenSearchParams) => {
    try {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            searchParams.append(key, value.toString());
          }
        });
      }
      const response = await api
        .get("tokens/search", { searchParams })
        .json<TokenListResponse>();
      return response;
    } catch (error) {
      console.error("Failed to search tokens:", error);
      throw error;
    }
  },
};

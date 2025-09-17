import { publicApi } from "@/constants/configs/ky";
import type {
  TExchangeRate,
  TExchangeRateParams,
} from "../types/exchange-rate";

export const exchangeRateApi = {
  getLatestExchangeRate: async (params?: TExchangeRateParams) => {
    try {
      const response = await publicApi
        .get("exchange-rates/latest", {
          searchParams: params,
        })
        .json<TExchangeRate>();
      return response;
    } catch (error) {
      console.error("Failed to fetch latest exchange rate:", error);
      throw error;
    }
  },
};

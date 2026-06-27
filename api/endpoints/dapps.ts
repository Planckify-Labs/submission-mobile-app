import type {
  DappCategoryListResponse,
  DappListResponse,
  DappPromotionListResponse,
  TDapp,
  TDappSearchParams,
} from "@/api/types/dapp";
import { api, publicApi } from "@/constants/configs/ky";
import {
  apiCall,
  fetchById,
  fetchList,
  searchItems,
} from "../utils/api-helpers";

export const dappApi = {
  getDappCategories: () =>
    apiCall(async () => {
      const response = await fetchList<DappCategoryListResponse>(
        publicApi,
        "dapp-categories",
        "Failed to fetch dapp categories",
      );
      return response;
    }, "Failed to fetch dapp categories"),

  getDappList: () =>
    apiCall(async () => {
      const response = await fetchList<DappListResponse>(
        publicApi,
        "dapps",
        "Failed to fetch dapp list",
      );
      return response;
    }, "Failed to fetch dapp list"),

  getPopularDapps: () =>
    apiCall(async () => {
      const response = await fetchList<DappListResponse>(
        publicApi,
        "dapps/popular",
        "Failed to fetch popular dapps",
      );
      return response;
    }, "Failed to fetch popular dapps"),

  getSponsoredDapps: () =>
    apiCall(async () => {
      const response = await fetchList<DappListResponse>(
        publicApi,
        "dapps/sponsor",
        "Failed to fetch sponsored dapps",
      );
      return response;
    }, "Failed to fetch sponsored dapps"),

  getFavoriteDapps: () =>
    apiCall(async () => {
      const response = await fetchList<DappListResponse>(
        publicApi,
        "dapps/favorites",
        "Failed to fetch favorite dapps",
      );
      return response;
    }, "Failed to fetch favorite dapps"),

  getDappsByCategory: (categoryId: string) =>
    apiCall(async () => {
      const response = await fetchList<DappListResponse>(
        publicApi,
        `dapps/category/${categoryId}`,
        "Failed to fetch dapps by category",
      );
      return response;
    }, "Failed to fetch dapps by category"),

  searchDapps: (params?: TDappSearchParams) =>
    apiCall(async () => {
      const response = await searchItems<DappListResponse>(
        publicApi,
        "dapps/search",
        params || {},
        "Failed to search dapps",
      );
      return response;
    }, "Failed to search dapps"),

  getDappById: (id: string) =>
    apiCall(async () => {
      const response = await fetchById<TDapp>(
        publicApi,
        "dapps",
        id,
        "Failed to fetch dapp by id",
      );
      return response;
    }, "Failed to fetch dapp by id"),

  getPromotions: () =>
    apiCall(async () => {
      const response = await fetchList<DappPromotionListResponse>(
        publicApi,
        "dapp-promotions",
        "Failed to fetch promotions",
      );
      return response;
    }, "Failed to fetch promotions"),

  // Favorites are local-first (MMKV); these power the optional background
  // sync once the user is signed in. Authed instance → uses the user's JWT.
  addFavorite: (id: string) =>
    apiCall(
      () => api.post(`dapps/${id}/favorite`).json<{ message: string }>(),
      "Failed to add favorite",
    ),

  removeFavorite: (id: string) =>
    apiCall(
      () => api.delete(`dapps/${id}/favorite`).then(() => undefined),
      "Failed to remove favorite",
    ),
};

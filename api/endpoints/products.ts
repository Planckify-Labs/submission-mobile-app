import { api, optionalAuthApi, publicApi } from "@/constants/configs/ky";
import type {
  TPaymentFeatured,
  TProduct,
  TProductCategory,
  TProductDetail,
  TProductInputFields,
  TProductVariant,
  TProductWithCategory,
  TRecommendation,
} from "../types/product";
import { fetchList, searchItems } from "../utils/api-helpers";

export interface TProductSearchParams {
  name?: string;
  categoryId?: string;
  isActive?: boolean;
  take?: number;
  cursor?: string;
}

export const productApi = {
  getAllProducts: (): Promise<TProduct[]> =>
    fetchList<TProduct[]>(publicApi, "products", "Failed to fetch products"),

  getProductsByCategories: (take?: number): Promise<TProductWithCategory[]> => {
    const params = take ? { take } : {};
    return searchItems<TProductWithCategory[]>(
      publicApi,
      "products/grouped-by-categories",
      params,
      "Failed to fetch products by categories",
    );
  },

  searchProducts: (params?: TProductSearchParams): Promise<TProduct[]> =>
    searchItems<TProduct[]>(
      publicApi,
      "products/search",
      params || {},
      "Failed to search products",
    ),

  getProductById: async (id: string): Promise<TProductDetail> => {
    try {
      const response = await publicApi.get(`products/${id}`);
      return response.json();
    } catch (error: any) {
      if (error && error.name === "AbortError") {
        console.log("Request was aborted");
        return {} as TProductDetail;
      }
      throw error;
    }
  },

  getProductsByCategory: async (categoryId: string): Promise<TProduct[]> => {
    const response = await publicApi.get(
      `products/categories/${categoryId}/products`,
    );
    return response.json();
  },

  getAllCategories: async (): Promise<TProductCategory[]> => {
    const response = await api.get("products/categories");
    return response.json();
  },

  getCategoryById: async (id: string): Promise<TProductCategory> => {
    const response = await api.get(`products/categories/${id}`);
    return response.json();
  },

  getProductVariantById: async (
    variantId: string,
  ): Promise<TProductVariant> => {
    const response = await publicApi.get(`products/variants/${variantId}`);
    return response.json();
  },

  getProductInputFields: async (
    productId: string,
  ): Promise<TProductInputFields> => {
    const response = await publicApi.get(`products/${productId}/input-fields`);
    return response.json();
  },

  getPaymentFeatured: async (): Promise<TPaymentFeatured> => {
    const response = await publicApi.get("products/payment-featured");
    return response.json();
  },

  getRecommendations: async (limit = 6): Promise<TRecommendation[]> => {
    const response = await optionalAuthApi.get("products/recommendations", {
      searchParams: { limit },
    });
    return response.json();
  },
};

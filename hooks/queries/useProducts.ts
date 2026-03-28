import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/endpoints/products";
import type {
  TPaymentFeatured,
  TProduct,
  TProductCategory,
  TProductDetail,
  TProductInputFields,
  TProductVariant,
  TProductWithCategory,
  TRecommendation,
} from "@/api/types/product";
import { productsQueryKeys } from "@/constants/queryKeys/productsQueryKeys";

export const useProducts = () => {
  return useQuery<TProduct[]>({
    queryKey: productsQueryKeys.lists(),
    queryFn: async () => {
      try {
        const response = await productApi.getAllProducts();
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useProductsByCategories = (take?: number) => {
  return useQuery<TProductWithCategory[]>({
    queryKey: productsQueryKeys.grouped(take),
    queryFn: async () => {
      try {
        const response = await productApi.getProductsByCategories(take || 8);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};

export const useProductById = (productId: string) => {
  return useQuery<TProductDetail>({
    queryKey: productsQueryKeys.byId(productId),
    queryFn: async (context) => {
      if (!productId) {
        return {} as TProductDetail;
      }

      try {
        const response = await productApi.getProductById(productId);
        return response;
      } catch (error) {
        if (context.signal && context.signal.aborted) {
          return {} as TProductDetail;
        }
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!productId,
    retry: (failureCount, error) => {
      if (error && error.name === "AbortError") return false;
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
};

export const useProductsByCategory = (categoryId: string) => {
  return useQuery<TProduct[]>({
    queryKey: productsQueryKeys.byCategory(categoryId),
    queryFn: async () => {
      try {
        const response = await productApi.getProductsByCategory(categoryId);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!categoryId,
  });
};

export const useCategories = () => {
  return useQuery<TProductCategory[]>({
    queryKey: productsQueryKeys.categories.all(),
    queryFn: async () => {
      try {
        const response = await productApi.getAllCategories();
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useCategory = (categoryId: string) => {
  return useQuery<TProductCategory>({
    queryKey: productsQueryKeys.categories.byId(categoryId),
    queryFn: async () => {
      try {
        const response = await productApi.getCategoryById(categoryId);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!categoryId,
  });
};

export const useProductVariantById = (variantId: string) => {
  return useQuery<TProductVariant>({
    queryKey: productsQueryKeys.variants.byId(variantId),
    queryFn: async () => {
      if (!variantId) {
        return {} as TProductVariant;
      }

      try {
        const response = await productApi.getProductVariantById(variantId);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!variantId,
    retry: (failureCount, error) => {
      if (error && error.name === "AbortError") return false;
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
};

export const useProductInputFields = (productId: string) => {
  return useQuery<TProductInputFields>({
    queryKey: productsQueryKeys.inputFields(productId),
    queryFn: async () => {
      if (!productId) {
        return {
          productId: "",
          productName: "",
          forms: [],
        } as TProductInputFields;
      }

      try {
        const response = await productApi.getProductInputFields(productId);
        return response;
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!productId,
    retry: (failureCount, error) => {
      if (error && error.name === "AbortError") return false;
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
};

export const useRecommendations = (limit = 6) => {
  return useQuery<TRecommendation[]>({
    queryKey: productsQueryKeys.recommendations(limit),
    queryFn: async () => {
      try {
        return await productApi.getRecommendations(limit);
      } catch (error) {
        console.error("API Error:", error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};

export const usePaymentFeatured = () => {
  return useQuery<TPaymentFeatured>({
    queryKey: productsQueryKeys.paymentFeatured(),
    queryFn: async () => {
      const response = await productApi.getPaymentFeatured();
      return response;
    },
    staleTime: 0,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

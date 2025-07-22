import { api } from "@/constants/configs/ky";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

interface TNonceResponse {
  nonce: string;
  message: string;
}

interface TVerifyRequest {
  message: string;
  signature: string;
}

interface TVerifySignatureResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    walletAddress: string;
  };
}

interface TRefreshTokenResponse {
  access_token: string;
}

const ACCESS_TOKEN_KEY = "takumipay_access_token";
const REFRESH_TOKEN_KEY = "takumipay_refresh_token";

export const storeTokens = async (
  accessToken: string,
  refreshToken: string,
): Promise<void> => {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error("Failed to store tokens:", error);
    throw new Error("Failed to store authentication tokens");
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to get access token:", error);
    return null;
  }
};

export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to get refresh token:", error);
    return null;
  }
};

export const clearTokens = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to clear tokens:", error);
  }
};

export const useNonce = (walletAddress?: string, chainId?: number) => {
  return useQuery<TNonceResponse>({
    queryKey: ["auth", "nonce", walletAddress, chainId],
    queryFn: async () => {
      if (!walletAddress) throw new Error("Wallet address is required");

      const endpoint = `auth/nonce/${walletAddress}${chainId ? `?chainId=${chainId}` : ""}`;

      try {
        const response = await api.get(endpoint).json<TNonceResponse>();
        return response;
      } catch (error) {
        console.error("Failed to fetch nonce:", error);
        throw error;
      }
    },
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useVerifySignature = () => {
  return useMutation<TVerifySignatureResponse, Error, TVerifyRequest>({
    mutationFn: async ({ message, signature }) => {
      try {
        const response = await api
          .post("auth/verify", {
            json: {
              message,
              signature,
            },
          })
          .json<TVerifySignatureResponse>();

        await storeTokens(response.access_token, response.refresh_token);

        return response;
      } catch (error) {
        console.error("Failed to verify signature:", error);
        throw error;
      }
    },
  });
};

export const useRefreshToken = () => {
  const queryClient = useQueryClient();

  const refreshTokenMutation = useMutation<TRefreshTokenResponse, Error>({
    mutationFn: async () => {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      try {
        const response = await api
          .post("auth/refresh", {
            json: {
              refresh_token: refreshToken,
            },
          })
          .json<TRefreshTokenResponse>();

        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.access_token);

        return response;
      } catch (error) {
        console.error("Failed to refresh token:", error);
        await clearTokens();
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const refreshAccessToken = useCallback(async () => {
    try {
      await refreshTokenMutation.mutateAsync();
      return true;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return false;
    }
  }, [refreshTokenMutation]);

  return {
    refreshAccessToken,
    isRefreshing: refreshTokenMutation.isPending,
    error: refreshTokenMutation.error,
  };
};

export const useIsAuthenticated = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshAccessToken } = useRefreshToken();

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setIsLoading(true);
        const accessToken = await getAccessToken();
        const refreshToken = await getRefreshToken();

        if (!accessToken && !refreshToken) {
          setIsAuthenticated(false);
          return;
        }

        if (!accessToken && refreshToken) {
          const refreshed = await refreshAccessToken();
          setIsAuthenticated(refreshed);
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthentication();
  }, [refreshAccessToken]);

  const logout = useCallback(async () => {
    await clearTokens();
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    logout,
  };
};

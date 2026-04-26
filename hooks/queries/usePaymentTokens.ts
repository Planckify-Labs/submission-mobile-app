import { useQuery } from "@tanstack/react-query";
import { api } from "@/constants/configs/ky";

export interface PaymentToken {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  decimals: number;
  isStablecoin: boolean;
  contractAddress: string | null;
  blockchain: {
    id: string;
    name: string;
    chainId: number | null;
  };
}

interface UsePaymentTokensOptions {
  blockchainId?: string;
}

async function fetchPaymentTokens(
  blockchainId?: string,
): Promise<PaymentToken[]> {
  const params = new URLSearchParams({
    isPaymentEnabled: "true",
    isActive: "true",
    take: "50",
  });
  if (blockchainId) {
    params.set("blockchainId", blockchainId);
  }
  return api.get(`tokens/search?${params}`).json<PaymentToken[]>();
}

export function usePaymentTokens(options?: UsePaymentTokensOptions) {
  const blockchainId = options?.blockchainId;
  return useQuery<PaymentToken[]>({
    queryKey: ["payment-tokens", blockchainId ?? "all"],
    queryFn: () => fetchPaymentTokens(blockchainId),
    staleTime: 5 * 60 * 1000,
  });
}

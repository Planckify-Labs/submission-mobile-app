import { useQuery } from "@tanstack/react-query";
import {
  smartContractApi,
  type TSmartContract,
} from "@/api/endpoints/smart-contracts";

interface UsePaymentContractOptions {
  blockchainId?: string;
  chainId?: number | null;
}

export function usePaymentContract(options: UsePaymentContractOptions) {
  const { blockchainId, chainId } = options;
  const hasFilter = Boolean(blockchainId) || (chainId != null && chainId > 0);

  return useQuery<TSmartContract | null>({
    queryKey: ["payment-contract", blockchainId ?? chainId ?? "none"],
    queryFn: async () => {
      if (blockchainId) {
        // A chain can also carry gateway/protocol SmartContract rows
        // (Circle Gateway, Aave, etc.) alongside takumi_pay — filter to
        // "payment" so this can't resolve to the wrong contract.
        const results = await smartContractApi.searchSmartContracts({
          blockchainId,
          type: "payment",
          isActive: true,
        });
        return results[0] ?? null;
      }
      if (chainId != null && chainId > 0) {
        return smartContractApi.getSmartContractsByChain(chainId);
      }
      return null;
    },
    enabled: hasFilter,
    staleTime: 5 * 60 * 1000,
  });
}

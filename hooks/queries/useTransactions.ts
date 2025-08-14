import { transactionApi } from "@/api/endpoints/transactions";
import type {
  TTransaction,
  TTransactionSearchParams,
} from "@/api/types/transaction";
import { transactionsQueryKeys } from "@/constants/queryKeys/transactionsQueryKeys";
import { useQuery } from "@tanstack/react-query";
import { useIsAuthenticated } from "@/hooks/queries/useAuth";

export const useTransactionSearch = (
  params: TTransactionSearchParams = {},
  options?: { enabled?: boolean },
) => {
  const { isAuthenticated, isLoading } = useIsAuthenticated();
  return useQuery({
    queryKey: transactionsQueryKeys.search(params),
    queryFn: async () => {
      const response = await transactionApi.searchTransactions(params);
      return response;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled:
      options?.enabled !== false &&
      !!params.senderAddress &&
      isAuthenticated === true &&
      isLoading === false,
    retry: false,
  });
};

export const useTransaction = (id: string) => {
  const { isAuthenticated, isLoading } = useIsAuthenticated();
  return useQuery({
    queryKey: transactionsQueryKeys.detail(id),
    queryFn: async () => {
      if (!id) {
        return {} as TTransaction;
      }

      const response = await transactionApi.getTransactionById(id);
      return response;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!id && isAuthenticated === true && isLoading === false,
    retry: false,
  });
};

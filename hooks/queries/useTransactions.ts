import { tokenApi } from "@/api/endpoints/tokens";
import { transactionApi } from "@/api/endpoints/transactions";
import type {
  TCreateTransactionRequest,
  TTransaction,
  TTransactionSearchParams,
} from "@/api/types/transaction";
import { transactionsQueryKeys } from "@/constants/queryKeys/transactionsQueryKeys";
import { useIsAuthenticated } from "@/hooks/queries/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

type TCreateTransactionInput =
  | TCreateTransactionRequest
  | (Omit<TCreateTransactionRequest, "tokenId"> & {
      contractAddress: string;
      blockchainId: string;
    });

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TCreateTransactionInput) => {
      try {
        let payload: TCreateTransactionRequest;

        if ((data as TCreateTransactionRequest).tokenId) {
          payload = data as TCreateTransactionRequest;
        } else {
          const nonNative = data as Omit<
            TCreateTransactionRequest,
            "tokenId"
          > & {
            contractAddress: string;
            blockchainId: string;
          };

          const tokens = await tokenApi.searchTokens({
            contractAddress: nonNative.contractAddress,
            blockchainId: nonNative.blockchainId,
          });
          const tokenId = tokens?.[0]?.id;
          if (!tokenId) {
            throw new Error("Unable to resolve tokenId for provided token");
          }

          const {
            contractAddress: _contractAddress,
            blockchainId: _blockchainId,
            ...rest
          } = nonNative;
          payload = { ...rest, tokenId } as TCreateTransactionRequest;
        }

        const response = await transactionApi.createTransaction(payload);
        return response;
      } catch (error) {
        console.error("API Error (create transaction):", error);
        throw error;
      }
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({
        queryKey: transactionsQueryKeys.search({} as any).slice(0, 2),
        exact: false,
      });
    },
  });
};

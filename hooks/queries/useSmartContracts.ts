import { useMutation, useQuery } from "@tanstack/react-query";
import {
  smartContractApi,
  TSmartContractSearchParams,
} from "@/api/endpoints/smart-contracts";

export const useSmartContracts = (params?: {
  blockchainId?: string;
  contractType?: string;
  name?: string;
  isActive?: boolean;
}) => {
  const query = useQuery({
    queryKey: ["smart-contracts", params],
    queryFn: () => smartContractApi.searchSmartContracts(params),
    enabled: !!params?.blockchainId,
  });

  const searchContract = useMutation({
    mutationFn: (searchParams: TSmartContractSearchParams) =>
      smartContractApi.searchSmartContracts(searchParams),
  });

  return {
    ...query,
    searchContract,
  };
};

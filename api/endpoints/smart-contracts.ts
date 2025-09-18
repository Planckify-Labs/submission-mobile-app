import { publicApi } from "@/constants/configs/ky";
import { fetchById, fetchList, searchItems } from "../utils/api-helpers";

export interface TBlockchain {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  isEVM: boolean;
  isActive: boolean;
  isTestnet: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TSmartContract {
  id: string;
  name: string;
  blockchain: TBlockchain;
  blockchainId: string;
  address: string;
  abiId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TSmartContractSearchParams {
  name?: string;
  address?: string;
  blockchainId?: string;
  contractType?: string;
  isVerified?: boolean;
  isActive?: boolean;
  take?: number;
  cursor?: string;
}

export type TSmartContractListResponse = TSmartContract[];

export const smartContractApi = {
  getSmartContractList: () =>
    fetchList<TSmartContractListResponse>(
      publicApi,
      "smart-contracts",
      "Failed to fetch smart contract list",
    ),

  searchSmartContracts: (params?: TSmartContractSearchParams) =>
    searchItems<TSmartContractListResponse>(
      publicApi,
      "smart-contracts/search",
      params || {},
      "Failed to search smart contracts",
    ),

  getSmartContractById: (id: string) =>
    fetchById<TSmartContract>(
      publicApi,
      "smart-contracts",
      id,
      "Failed to fetch smart contract by id",
    ),
};

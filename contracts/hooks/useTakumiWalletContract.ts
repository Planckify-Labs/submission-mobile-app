import { useWallet } from "@/hooks/useWallet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Address, Hash } from "viem";
import { getContract } from "viem";
import AbiTakumiWallet from "../abis/AbiTakumiWallet";
import type {
  TCreateTransactionParams,
  TGetTransactionsByAddressParams,
  TGetTransactionsInRangeParams,
  TGetUserTransactionsParams,
  TTakumiTransaction,
} from "../types/TTakumiWallet";

interface UseTakumiWalletContractProps {
  contractAddress: Address;
}

export function useTakumiWalletContract({
  contractAddress,
}: UseTakumiWalletContractProps) {
  const {
    getClientForActiveWallet,
    getPublicClientForActiveChain,
    activeWallet,
  } = useWallet();

  const publicClient = getPublicClientForActiveChain();
  const walletClient = getClientForActiveWallet();

  const readContract = useMemo(() => {
    return getContract({
      address: contractAddress,
      abi: AbiTakumiWallet,
      client: publicClient,
    });
  }, [contractAddress, publicClient]);

  const writeContract = useMemo(() => {
    if (!walletClient) return null;
    return getContract({
      address: contractAddress,
      abi: AbiTakumiWallet,
      client: walletClient,
    });
  }, [contractAddress, walletClient]);

  const getAllAdmins = useQuery({
    queryKey: ["takumi-wallet", "admins", contractAddress],
    queryFn: async () => {
      return await readContract.read.getAllAdmins();
    },
    enabled: !!readContract,
  });

  const getOwner = useQuery({
    queryKey: ["takumi-wallet", "owner", contractAddress],
    queryFn: async () => {
      return await readContract.read.owner();
    },
    enabled: !!readContract,
  });

  const getTxCounter = useQuery({
    queryKey: ["takumi-wallet", "txCounter", contractAddress],
    queryFn: async () => {
      return await readContract.read.txCounter();
    },
    enabled: !!readContract,
  });

  const isAdmin = useCallback(
    async (adminAddress: Address) => {
      if (!readContract) throw new Error("Contract not initialized");
      return await readContract.read.isAdmin([adminAddress]);
    },
    [readContract],
  );

  const getTransactionByRef = useCallback(
    async (refId: string) => {
      if (!readContract) throw new Error("Contract not initialized");
      const result = await readContract.read.getTransactionByRef([refId]);
      return result as TTakumiTransaction;
    },
    [readContract],
  );

  const getTransactionsByAddress = useCallback(
    async (params: TGetTransactionsByAddressParams) => {
      if (!readContract) throw new Error("Contract not initialized");
      const result = await readContract.read.getTransactionsByAddress([
        params.user,
        params.offset,
        params.limit,
      ]);
      return result as TTakumiTransaction[];
    },
    [readContract],
  );

  const getTransactionsInRange = useCallback(
    async (params: TGetTransactionsInRangeParams) => {
      if (!readContract) throw new Error("Contract not initialized");
      const result = await readContract.read.getTransactionsInRange([
        params.start,
        params.end,
        params.offset,
        params.limit,
      ]);
      return result as TTakumiTransaction[];
    },
    [readContract],
  );

  const getUserTransactions = useCallback(
    async (params: TGetUserTransactionsParams) => {
      if (!readContract) throw new Error("Contract not initialized");
      const result = await readContract.read.getUserTransactions([
        params.offset,
        params.limit,
      ]);
      return result as TTakumiTransaction[];
    },
    [readContract],
  );

  const getUserTransactionCount = useCallback(
    async (userAddress?: Address) => {
      if (!readContract) throw new Error("Contract not initialized");
      const targetAddress = userAddress || activeWallet?.address;
      if (!targetAddress) throw new Error("No user address provided");
      return await readContract.read.getUserTransactionCount([
        targetAddress as Address,
      ]);
    },
    [readContract, activeWallet?.address],
  );

  const addAdmin = useMutation({
    mutationFn: async (adminAddress: Address) => {
      if (!walletClient || !walletClient.account)
        throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: AbiTakumiWallet,
        functionName: "addAdmin",
        args: [adminAddress],
        chain: walletClient.chain,
        account: walletClient.account,
      });
      return hash as Hash;
    },
  });

  const removeAdmin = useMutation({
    mutationFn: async (adminAddress: Address) => {
      if (!walletClient || !walletClient.account)
        throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: AbiTakumiWallet,
        functionName: "removeAdmin",
        args: [adminAddress],
        chain: walletClient.chain,
        account: walletClient.account,
      });
      return hash as Hash;
    },
  });

  const createTransaction = useMutation({
    mutationFn: async (params: TCreateTransactionParams) => {
      if (!walletClient || !walletClient.account)
        throw new Error("Wallet not connected");
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: AbiTakumiWallet,
        functionName: "createTransaction",
        args: [
          params.bookingId,
          params.exchangeRateId,
          params.productVariantId,
          params.tokenAddress,
          params.refId,
        ],
        chain: walletClient.chain,
        account: walletClient.account,
      });
      return hash as Hash;
    },
  });

  const useWatchTransactionCreated = (
    onTransactionCreated?: (log: any) => void,
    enabled: boolean = true,
  ) => {
    return useQuery({
      queryKey: ["takumi-wallet", "watchTransactionCreated", contractAddress],
      queryFn: async () => {
        if (!publicClient || !onTransactionCreated || !enabled) return null;

        const unwatch = publicClient.watchContractEvent({
          address: contractAddress,
          abi: AbiTakumiWallet,
          eventName: "TransactionCreated",
          onLogs: onTransactionCreated,
        });

        return unwatch;
      },
      enabled: !!publicClient && !!onTransactionCreated && enabled,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  };

  const useWatchAdminAdded = (
    onAdminAdded?: (log: any) => void,
    enabled: boolean = true,
  ) => {
    return useQuery({
      queryKey: ["takumi-wallet", "watchAdminAdded", contractAddress],
      queryFn: async () => {
        if (!publicClient || !onAdminAdded || !enabled) return null;

        const unwatch = publicClient.watchContractEvent({
          address: contractAddress,
          abi: AbiTakumiWallet,
          eventName: "AdminAdded",
          onLogs: onAdminAdded,
        });

        return unwatch;
      },
      enabled: !!publicClient && !!onAdminAdded && enabled,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  };

  const useWatchAdminRemoved = (
    onAdminRemoved?: (log: any) => void,
    enabled: boolean = true,
  ) => {
    return useQuery({
      queryKey: ["takumi-wallet", "watchAdminRemoved", contractAddress],
      queryFn: async () => {
        if (!publicClient || !onAdminRemoved || !enabled) return null;

        const unwatch = publicClient.watchContractEvent({
          address: contractAddress,
          abi: AbiTakumiWallet,
          eventName: "AdminRemoved",
          onLogs: onAdminRemoved,
        });

        return unwatch;
      },
      enabled: !!publicClient && !!onAdminRemoved && enabled,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });
  };

  const getTransaction = useCallback(
    async (txId: bigint) => {
      if (!readContract) throw new Error("Contract not initialized");
      return await readContract.read.transactions([txId]);
    },
    [readContract],
  );

  const waitForTransaction = useCallback(
    async (hash: Hash) => {
      if (!publicClient) throw new Error("Public client not available");
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    [publicClient],
  );

  const getContractLogs = useCallback(
    async (
      eventName: "AdminAdded" | "AdminRemoved" | "TransactionCreated",
      fromBlock?: bigint,
      toBlock?: bigint,
    ) => {
      if (!publicClient) throw new Error("Public client not available");
      return await publicClient.getContractEvents({
        address: contractAddress,
        abi: AbiTakumiWallet,
        eventName,
        fromBlock,
        toBlock,
      });
    },
    [publicClient, contractAddress],
  );

  return {
    readContract,
    writeContract,
    getAllAdmins,
    getOwner,
    getTxCounter,
    isAdmin,
    getTransactionByRef,
    getTransactionsByAddress,
    getTransactionsInRange,
    getUserTransactions,
    getUserTransactionCount,
    addAdmin,
    removeAdmin,
    createTransaction,
    useWatchTransactionCreated,
    useWatchAdminAdded,
    useWatchAdminRemoved,
    getTransaction,
    waitForTransaction,
    getContractLogs,
    isConnected: !!writeContract,
    activeWallet,
  };
}

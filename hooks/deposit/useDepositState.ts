import { useCallback, useEffect, useMemo } from "react";
import { router } from "expo-router";
import { TToken } from "@/api/types/token";
import { useBlockchains } from "@/hooks/queries/useBlockchains";
import { useTokens } from "@/hooks/queries/useTokens";
import { useWallet } from "@/hooks/useWallet";
import useRQGlobalState from "@/hooks/useRQGlobalState";

const DEPOSIT_STATE_KEY = ["deposit", "state"] as const;

interface DepositState {
  selectedToken?: TToken;
  amount: string;
  isLoading: boolean;
  transactionStatus: string;
}

const initialDepositState: DepositState = {
  selectedToken: undefined,
  amount: "",
  isLoading: false,
  transactionStatus: "",
};

export function useDepositState() {
  const { data: state, setNewData: setState } = useRQGlobalState<DepositState>({
    queryKey: DEPOSIT_STATE_KEY,
    initialData: initialDepositState,
  });

  const { activeChain } = useWallet();
  const { data: blockchains } = useBlockchains();

  const activeBackendChain = useMemo(
    () => blockchains?.find((b) => b.chainId === activeChain.chain.id) || null,
    [blockchains, activeChain.chain.id]
  );

  const { data: stablecoinTokens } = useTokens({
    isStablecoin: true,
    isActive: true,
    blockchainId: activeBackendChain?.id,
  });

  const selectedToken = state?.selectedToken;
  const amount = state?.amount ?? "";
  const isLoading = state?.isLoading ?? false;
  const transactionStatus = state?.transactionStatus ?? "";

  useEffect(() => {
    if (stablecoinTokens && stablecoinTokens.length > 0) {
      if (
        !selectedToken ||
        !stablecoinTokens.some((token) => token.id === selectedToken?.id)
      ) {
        setState({
          selectedToken: stablecoinTokens[0],
          amount,
          isLoading,
          transactionStatus,
        });
      }
    } else if (selectedToken) {
      setState({
        selectedToken: undefined,
        amount,
        isLoading,
        transactionStatus,
      });
    }
  }, [stablecoinTokens]);

  const setSelectedToken = useCallback(
    (token: TToken) => {
      setState({
        selectedToken: token,
        amount,
        isLoading,
        transactionStatus,
      });
    },
    [amount, isLoading, transactionStatus, setState]
  );

  const setAmount = useCallback(
    (value: string) => {
      setState({
        selectedToken,
        amount: value,
        isLoading,
        transactionStatus,
      });
    },
    [selectedToken, isLoading, transactionStatus, setState]
  );

  const setQuickAmount = useCallback(
    (value: string) => {
      setState({
        selectedToken,
        amount: value,
        isLoading,
        transactionStatus,
      });
    },
    [selectedToken, isLoading, transactionStatus, setState]
  );

  const validateInputs = useCallback(() => {
    if (!amount || parseFloat(amount) < 15000) {
      console.error("Error: Minimum is 15,000 points");
      return false;
    }
    return true;
  }, [amount]);

  const handleDeposit = useCallback(async () => {
    if (!validateInputs()) return;

    setState({
      selectedToken,
      amount,
      isLoading: true,
      transactionStatus: "Preparing deposit...",
    });

    try {
      setState({
        selectedToken,
        amount,
        isLoading: true,
        transactionStatus: "Generating deposit address...",
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setState({
        selectedToken,
        amount,
        isLoading: true,
        transactionStatus: "Adding points...",
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log(
        "Points Added:",
        `${amount} points (${amount} ${selectedToken?.symbol || "tokens"})`
      );
      router.back();
    } catch (error) {
      console.error("Deposit error:", error);
    } finally {
      setState({
        selectedToken,
        amount,
        isLoading: false,
        transactionStatus: "",
      });
    }
  }, [selectedToken, amount, setState, validateInputs]);

  const resetState = useCallback(() => {
    setState(initialDepositState);
  }, [setState]);

  return {
    selectedToken,
    amount,
    isLoading,
    transactionStatus,
    stablecoinTokens: stablecoinTokens ?? [],
    activeChain,
    setSelectedToken,
    setAmount,
    setQuickAmount,
    handleDeposit,
    resetState,
  };
}

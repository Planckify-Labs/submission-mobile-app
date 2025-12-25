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
  fiatAmount: string;
  isLoading: boolean;
  transactionStatus: string;
}

const initialDepositState: DepositState = {
  selectedToken: undefined,
  amount: "",
  fiatAmount: "",
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
  const fiatAmount = state?.fiatAmount ?? "";
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
          fiatAmount,
          isLoading,
          transactionStatus,
        });
      }
    } else if (selectedToken) {
      setState({
        selectedToken: undefined,
        amount,
        fiatAmount,
        isLoading,
        transactionStatus,
      });
    }
  }, [stablecoinTokens]);

  const getExchangeRate = useCallback((token?: TToken) => {
    if (!token) return 1.0;
    if (token.symbol === "USDT" || token.symbol === "USDC") {
      return 1.0;
    }
    return 1.0;
  }, []);

  const exchangeRate = useMemo(
    () => getExchangeRate(selectedToken),
    [selectedToken, getExchangeRate]
  );

  const setSelectedToken = useCallback(
    (token: TToken) => {
      setState({
        selectedToken: token,
        amount,
        fiatAmount,
        isLoading,
        transactionStatus,
      });
    },
    [amount, fiatAmount, isLoading, transactionStatus, setState]
  );

  const setAmount = useCallback(
    (value: string) => {
      const newFiatAmount =
        value && !isNaN(parseFloat(value))
          ? (parseFloat(value) * exchangeRate).toFixed(2)
          : "";
      setState({
        selectedToken,
        amount: value,
        fiatAmount: newFiatAmount,
        isLoading,
        transactionStatus,
      });
    },
    [selectedToken, isLoading, transactionStatus, setState, exchangeRate]
  );

  const setFiatAmount = useCallback(
    (value: string) => {
      const newAmount =
        value && !isNaN(parseFloat(value))
          ? (parseFloat(value) / exchangeRate).toFixed(2)
          : "";
      setState({
        selectedToken,
        amount: newAmount,
        fiatAmount: value,
        isLoading,
        transactionStatus,
      });
    },
    [selectedToken, isLoading, transactionStatus, setState, exchangeRate]
  );

  const setQuickAmount = useCallback(
    (value: string) => {
      const newFiatAmount = (parseFloat(value) * exchangeRate).toFixed(2);
      setState({
        selectedToken,
        amount: value,
        fiatAmount: newFiatAmount,
        isLoading,
        transactionStatus,
      });
    },
    [selectedToken, isLoading, transactionStatus, setState, exchangeRate]
  );

  const validateInputs = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) {
      console.error("Error: Please enter a valid amount");
      return false;
    }
    return true;
  }, [amount]);

  const handleDeposit = useCallback(async () => {
    if (!validateInputs()) return;

    setState({
      selectedToken,
      amount,
      fiatAmount,
      isLoading: true,
      transactionStatus: "Preparing deposit instructions...",
    });

    try {
      setState({
        selectedToken,
        amount,
        fiatAmount,
        isLoading: true,
        transactionStatus: "Generating deposit address...",
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setState({
        selectedToken,
        amount,
        fiatAmount,
        isLoading: true,
        transactionStatus: "Waiting for deposit confirmation...",
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log(
        "Deposit Instructions Ready:",
        `Send ${amount} ${selectedToken?.symbol || "tokens"} to your wallet address`
      );
      router.back();
    } catch (error) {
      console.error("Deposit error:", error);
    } finally {
      setState({
        selectedToken,
        amount,
        fiatAmount,
        isLoading: false,
        transactionStatus: "",
      });
    }
  }, [selectedToken, amount, fiatAmount, setState, validateInputs]);

  const resetState = useCallback(() => {
    setState(initialDepositState);
  }, [setState]);

  return {
    selectedToken,
    amount,
    fiatAmount,
    isLoading,
    transactionStatus,
    exchangeRate,
    stablecoinTokens: stablecoinTokens ?? [],
    activeChain,
    setSelectedToken,
    setAmount,
    setFiatAmount,
    setQuickAmount,
    handleDeposit,
    resetState,
  };
}

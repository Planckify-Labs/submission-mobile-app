import { useSmartContracts } from "./useSmartContracts";

export const usePaymentProcessorContract = (blockchainId?: string) => {
  const {
    data: contracts,
    isLoading,
    error,
  } = useSmartContracts({
    blockchainId,
    name: "Payment Processor",
    isActive: true,
  });
  console.log("payment processor contract", contracts);

  const paymentProcessorContract = contracts?.[0];

  return {
    contractAddress: paymentProcessorContract?.address,
    contract: paymentProcessorContract,
    isLoading,
    error,
    isFound: !!paymentProcessorContract,
  };
};

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

  const paymentProcessorContract = contracts?.[0];
  console.log(paymentProcessorContract);

  return {
    contractAddress: paymentProcessorContract?.address,
    contract: paymentProcessorContract,
    isLoading,
    error,
    isFound: !!paymentProcessorContract,
  };
};

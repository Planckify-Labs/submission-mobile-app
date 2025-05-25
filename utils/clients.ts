import {
  Account,
  Chain,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
type TChainConfig = Chain;

export const getPublicClient = (chain: TChainConfig) => {
  const publicClient = createPublicClient({
    chain: chain,
    transport: http(),
  });
  return publicClient;
};

export const getWalletClient = (account: Account, chain: TChainConfig) => {
  const walletClient = createWalletClient({
    account,
    chain: chain,
    transport: http(),
  });
  return walletClient;
};

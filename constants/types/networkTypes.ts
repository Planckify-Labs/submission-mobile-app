export type TNetwork = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  isPinned: boolean;
};

export type TWalletInfoProps = {
  activeWallet: import("./walletTypes").TWallet | undefined;
};

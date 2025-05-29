export type WalletSource = "Created" | "Imported" | "Social";
export type WalletType = "PrivateKey" | "SeedPhrase" | "Social";

export interface TWallet {
  name: string;
  address: string;
  balance: string;
  source: WalletSource;
  type: WalletType;
  account: any;
  privateKey?: string;
  seedPhrase?: string;
  socialAccount?: {
    provider: string;
    email: string;
    name: string;
  };
}

export interface TWalletCreationParams {
  source: "social" | "SeedPhrase" | "PrivateKey";
  privateKey?: string;
  seedPhrase?: string;
  name?: string;
  provider?: string;
  socialAccount?: { email: string; name: string };
  account?: any;
}

export const WALLET_SETUP_PROGRESS_KEY = "walletSetupProgress";

export type TSelectedWords = { [key: number]: string };
export type TWordOptions = { [key: number]: string[] };
export type TSetupProgress = {
  step: number;
  mnemonic: string[];
  selectedWords: TSelectedWords;
};

export type TWalletSetupStep = {
  title: string;
  content: React.ReactNode;
  buttonText: string;
  onButtonPress: () => void;
};

export type TWalletSetupStepsProps = {
  currentStep: number;
  steps: TWalletSetupStep[];
  onBackPress: () => void;
  disableBackButton?: boolean;
};

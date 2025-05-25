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

export interface WalletCreationParams {
  source: "social" | "SeedPhrase" | "PrivateKey";
  privateKey?: string;
  seedPhrase?: string;
  name?: string;
  provider?: string;
  socialAccount?: { email: string; name: string };
  account?: any;
}

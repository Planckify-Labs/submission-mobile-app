import type { Namespace } from "@/services/chains/types";

export type WalletSource = "Created" | "Imported" | "Social";
export type WalletType =
  | "PrivateKey"
  | "SeedPhrase"
  | "Social"
  | "Smart4337"
  | "Smart7702";

export interface TSmart4337Fields {
  signerWalletId: string;
  factory?: string;
  bundlerUrl: string;
  entryPoint: string;
}

export interface TSmart7702Fields {
  signerWalletId: string;
  delegator: `0x${string}`;
  authorizationByChain?: Record<
    number,
    { expiresAt: number; signature?: `0x${string}`; nonce: number }
  >;
}

export interface TSolanaFields {
  pubkeyBase58: string;
  derivationPath?: string;
}

export interface TSuiFields {
  /** 0x-prefixed 32-byte hex (canonical Sui address). */
  suiAddress: string;
  /** Raw 32-byte ed25519 public key, hex. */
  pubkeyHex: string;
  /** SLIP-0010 ed25519 path. Absent ⇒ default `m/44'/784'/0'/0'/0'`. */
  derivationPath?: string;
  /** Signing scheme; only `ed25519` in v1. Future Secp variants need a new gate. */
  scheme: "ed25519";
}

export interface TWallet {
  name: string;
  address: string;
  balance: string;
  source: WalletSource;
  type: WalletType;
  namespace: Namespace;
  chainId?: string | number;
  account: any;
  /**
   * For EVM rows: 0x-prefixed 32-byte hex.
   * For Solana rows: base58-encoded 32-byte seed.
   * For Sui rows: bech32 `suiprivkey1…` form so the dwell site re-decodes
   *   without re-running BIP-39. `address` mirrors `sui.suiAddress`.
   */
  privateKey?: string;
  seedPhrase?: string;
  socialAccount?: {
    provider: string;
    email: string;
    name: string;
  };
  smart4337?: TSmart4337Fields;
  smart7702?: TSmart7702Fields;
  solana?: TSolanaFields;
  sui?: TSuiFields;
}

export interface TWalletCreationParams {
  source:
    | "social"
    | "SeedPhrase"
    | "PrivateKey"
    | "SolanaSeedPhrase"
    | "SolanaPrivateKey"
    | "SuiSeedPhrase"
    | "SuiPrivateKey";
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

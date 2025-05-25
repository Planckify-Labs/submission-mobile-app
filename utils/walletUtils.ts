import { type TWallet } from "@/hooks/useWallet";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

export function isValidPrivateKey(privateKey: string): boolean {
  const privateKeyRegex = /^(0x)?[0-9a-fA-F]{64}$/;
  return privateKeyRegex.test(privateKey);
}

export function isValidMnemonic(mnemonic: string): boolean {
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
}

export function createWalletFromPrivateKey(
  privateKey: string,
  name?: string,
): TWallet {
  const formattedKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;

  const account = privateKeyToAccount(formattedKey as `0x${string}`);

  return {
    account,
    address: account.address,
    privateKey: formattedKey,
    name: name || "Imported Wallet",
    balance: "0",
    source: "Imported",
    type: "PrivateKey",
  };
}

export function createWalletFromMnemonic(
  seedPhrase: string,
  name?: string,
): TWallet {
  const account = mnemonicToAccount(seedPhrase);

  return {
    account,
    address: account.address,
    seedPhrase,
    name: name || "Seed Phrase Wallet",
    balance: "0",
    source: "Created",
    type: "SeedPhrase",
  };
}

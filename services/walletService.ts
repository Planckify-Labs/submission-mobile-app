import { TWallet } from "@/hooks/useWallet";
import * as SecureStore from "expo-secure-store";
import {
  type HDAccount,
  type PrivateKeyAccount,
  mnemonicToAccount,
  privateKeyToAccount,
} from "viem/accounts";

const accountCache: Record<string, HDAccount | PrivateKeyAccount> = {};

export async function loadWalletsFromStorage(): Promise<TWallet[]> {
  try {
    const walletsData = await SecureStore.getItemAsync("user_wallets");
    if (!walletsData) return [];

    const parsedWallets = JSON.parse(walletsData);
    return parsedWallets;
  } catch (error) {
    console.error("Failed to load wallets:", error);
    return [];
  }
}

export async function saveWalletsToStorage(
  wallets: TWallet[],
): Promise<boolean> {
  try {
    const walletsForStorage = wallets.map((wallet) => {
      const { account, ...walletWithoutAccount } = wallet;

      return {
        ...walletWithoutAccount,
        account: { address: wallet.address },
      };
    });

    await SecureStore.setItemAsync(
      "user_wallets",
      JSON.stringify(walletsForStorage),
    );
    return true;
  } catch (error) {
    console.error("Failed to save wallets:", error);
    return false;
  }
}

export function getAccountForWallet(
  wallet: TWallet,
): HDAccount | PrivateKeyAccount | null {
  if (accountCache[wallet.address]) {
    return accountCache[wallet.address];
  }

  try {
    let account: HDAccount | PrivateKeyAccount | null = null;

    if (wallet.type === "PrivateKey" && wallet.privateKey) {
      account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
    } else if (wallet.type === "SeedPhrase" && wallet.seedPhrase) {
      account = mnemonicToAccount(wallet.seedPhrase);
    }

    if (account) {
      accountCache[wallet.address] = account;
    }

    return account;
  } catch (error) {
    console.error("Error creating account:", error);
    return null;
  }
}

export function clearAccountCache(address?: string): void {
  if (address) {
    delete accountCache[address];
  } else {
    Object.keys(accountCache).forEach((key) => {
      delete accountCache[key];
    });
  }
}

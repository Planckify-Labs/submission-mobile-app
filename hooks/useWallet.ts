import { usePerformance } from "@/components/providers/PerformanceProvider";
import { ChainConfig, supportedChains } from "@/constants/configs/chainConfig";
import * as walletService from "@/services/walletService";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, InteractionManager } from "react-native";
import {
  type HDAccount,
  type PrivateKeyAccount,
  mnemonicToAccount,
  privateKeyToAccount,
} from "viem/accounts";

export interface TWallet {
  name: string;
  address: string;
  balance: string;
  source: "Created" | "Imported" | "Social";
  type: "PrivateKey" | "SeedPhrase" | "Social";
  account: HDAccount | PrivateKeyAccount | any;
  privateKey?: string;
  seedPhrase?: string;
  socialAccount?: {
    provider: string;
    email: string;
    name: string;
  };
}

export function useWallet() {
  const [wallets, setWallets] = useState<TWallet[]>([]);
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChain, setActiveChain] = useState<ChainConfig>(
    supportedChains[0],
  );
  const { deferredTask } = usePerformance();

  const activeWallet = useMemo(
    () => wallets[activeWalletIndex] || ({} as TWallet),
    [wallets, activeWalletIndex],
  );

  const loadActiveChain = useCallback(async () => {
    try {
      const storedChainId = await SecureStore.getItemAsync("active_chain_id");
      if (storedChainId) {
        const chainId = parseInt(storedChainId, 10);
        const chain = supportedChains.find(
          (c: ChainConfig) => c.chain.id === chainId,
        );
        if (chain) {
          setActiveChain(chain);
        }
      }
    } catch (error) {
      console.error("Failed to load active chain:", error);
    }
  }, []);

  const saveActiveChain = useCallback(async (chain: ChainConfig) => {
    try {
      await SecureStore.setItemAsync(
        "active_chain_id",
        chain.chain.id.toString(),
      );
      setActiveChain(chain);
      return true;
    } catch (error) {
      console.error("Failed to save active chain:", error);
      return false;
    }
  }, []);

  const changeActiveChain = useCallback(
    async (chainId: number) => {
      const chain = supportedChains.find(
        (c: ChainConfig) => c.chain.id === chainId,
      );
      if (chain) {
        return await saveActiveChain(chain);
      }
      return false;
    },
    [saveActiveChain],
  );

  const loadWallets = useCallback(async () => {
    try {
      setIsLoading(true);

      await deferredTask(async () => {
        const loadedWallets = await walletService.loadWalletsFromStorage();
        setWallets(loadedWallets);
      }, "Loading wallets");
    } catch (error) {
      console.error("Failed to load wallets:", error);
      Alert.alert("Error", "Failed to load wallet information");
    } finally {
      setIsLoading(false);
    }
  }, [deferredTask]);

  const saveWallets = useCallback(async (updatedWallets: TWallet[]) => {
    try {
      const success = await walletService.saveWalletsToStorage(updatedWallets);
      if (success) {
        setWallets(updatedWallets);
      }
      return success;
    } catch (error) {
      console.error("Failed to save wallets:", error);
      Alert.alert("Error", "Failed to save wallet information");
      return false;
    }
  }, []);

  const addWallet = useCallback(
    async (walletData: {
      source: "social" | "SeedPhrase" | "PrivateKey";
      privateKey?: string;
      seedPhrase?: string;
      name?: string;
      provider?: string;
      socialAccount?: { email: string; name: string };
      account?: any;
    }) => {
      return await deferredTask(async () => {
        let wallet: TWallet;

        if (walletData.source === "PrivateKey" && walletData.privateKey) {
          const formattedKey = walletData.privateKey.startsWith("0x")
            ? walletData.privateKey
            : `0x${walletData.privateKey}`;

          const account = privateKeyToAccount(formattedKey as `0x${string}`);

          wallet = {
            account: { address: account.address },
            address: account.address,
            privateKey: formattedKey,
            name: walletData.name || "Imported Wallet",
            balance: "0",
            source: "Imported",
            type: "PrivateKey",
          };
        } else if (
          walletData.source === "SeedPhrase" &&
          walletData.seedPhrase
        ) {
          const account = mnemonicToAccount(walletData.seedPhrase);

          wallet = {
            account: { address: account.address },
            address: account.address,
            seedPhrase: walletData.seedPhrase,
            name: walletData.name || "Seed Phrase Wallet",
            balance: "0",
            source: "Created",
            type: "SeedPhrase",
          };
        } else if (walletData.source === "social" && walletData.account) {
          wallet = {
            account: { address: walletData.account.address },
            address: walletData.account.address,
            name: walletData.name || "Social Wallet",
            balance: "0",
            source: "Social",
            type: "Social",
            socialAccount: {
              provider: walletData.provider || "Unknown",
              email: walletData.socialAccount?.email || "",
              name: walletData.socialAccount?.name || "",
            },
          };
        } else {
          return false;
        }

        const updatedWallets = [...wallets, wallet];
        const success = await saveWallets(updatedWallets);
        if (success) {
          setActiveWalletIndex(updatedWallets.length - 1);
        }
        return success;
      }, "Adding wallet");
    },
    [wallets, saveWallets, deferredTask],
  );

  const updateWallet = useCallback(
    async (index: number, updatedWallet: TWallet) => {
      if (index < 0 || index >= wallets.length) return false;

      const updatedWallets = [...wallets];
      updatedWallets[index] = updatedWallet;
      return await saveWallets(updatedWallets);
    },
    [wallets, saveWallets],
  );

  const removeWallet = useCallback(
    async (index: number) => {
      if (index < 0 || index >= wallets.length) return false;

      const updatedWallets = wallets.filter((_, i) => i !== index);
      const success = await saveWallets(updatedWallets);

      if (success && activeWalletIndex >= updatedWallets.length) {
        setActiveWalletIndex(Math.max(0, updatedWallets.length - 1));
      }

      return success;
    },
    [wallets, activeWalletIndex, saveWallets],
  );

  const setActiveWallet = useCallback((index: number) => {
    setActiveWalletIndex(index);
  }, []);

  const getWalletAccount = useCallback(
    async (walletIndex: number) => {
      if (walletIndex < 0 || walletIndex >= wallets.length) return null;

      const wallet = wallets[walletIndex];

      return await deferredTask(() => {
        return walletService.getAccountForWallet(wallet);
      }, "Getting wallet account");
    },
    [wallets, deferredTask],
  );

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      loadWallets();
      loadActiveChain();
    });

    return () => {
      walletService.clearAccountCache();
    };
  }, [loadWallets, loadActiveChain]);

  return useMemo(
    () => ({
      wallets,
      activeWallet,
      activeWalletIndex,
      isLoading,
      activeChain,
      setActiveWallet,
      loadWallets,
      saveWallets,
      addWallet,
      updateWallet,
      removeWallet,
      changeActiveChain,
      getWalletAccount,
    }),
    [
      wallets,
      activeWallet,
      activeWalletIndex,
      isLoading,
      activeChain,
      setActiveWallet,
      loadWallets,
      saveWallets,
      addWallet,
      updateWallet,
      removeWallet,
      changeActiveChain,
      getWalletAccount,
    ],
  );
}

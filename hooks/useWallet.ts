import { usePerformance } from "@/components/providers/PerformanceProvider";
import { ChainConfig, supportedChains } from "@/constants/configs/chainConfig";
import { TWallet, WalletCreationParams } from "@/constants/types/walletTypes";
import * as walletService from "@/services/walletService";
import { createWalletFromParams } from "@/utils/walletUtils";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, InteractionManager } from "react-native";

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
    async (walletData: WalletCreationParams) => {
      return await deferredTask(async () => {
        const wallet = createWalletFromParams(walletData);
        if (!wallet) return false;

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

  const saveActiveChain = useCallback(async (chain: ChainConfig) => {
    try {
      await SecureStore.setItemAsync("active_chain", JSON.stringify(chain));
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

  const loadActiveChain = useCallback(async () => {
    try {
      const storedChain = await SecureStore.getItemAsync("active_chain");
      if (storedChain) {
        const parsedChain = JSON.parse(storedChain) as ChainConfig;
        setActiveChain(parsedChain);
      }
    } catch (error) {
      console.error("Failed to load active chain:", error);
    }
  }, []);

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

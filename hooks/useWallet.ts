import { ChainConfig, supportedChains } from "@/constants/configs/chainConfig";
import { type TWallet, mockWallets } from "@/constants/walletData";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

export function useWallet() {
  const [wallets, setWallets] = useState<TWallet[]>([]);
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChain, setActiveChain] = useState<ChainConfig>(
    supportedChains[0],
  );

  const activeWallet = wallets[activeWalletIndex] || ({} as TWallet);

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
      const walletsData = await SecureStore.getItemAsync("user_wallets");
      if (walletsData) {
        setWallets(JSON.parse(walletsData));
      } else {
        setWallets(mockWallets);
      }
    } catch (error) {
      console.error("Failed to load wallets:", error);
      Alert.alert("Error", "Failed to load wallet information");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveWallets = useCallback(async (updatedWallets: TWallet[]) => {
    try {
      await SecureStore.setItemAsync(
        "user_wallets",
        JSON.stringify(updatedWallets),
      );
      setWallets(updatedWallets);
      return true;
    } catch (error) {
      console.error("Failed to save wallets:", error);
      Alert.alert("Error", "Failed to save wallet information");
      return false;
    }
  }, []);

  const addWallet = useCallback(
    async (wallet: TWallet) => {
      const updatedWallets = [...wallets, wallet];
      const success = await saveWallets(updatedWallets);
      if (success) {
        setActiveWalletIndex(updatedWallets.length - 1);
      }
      return success;
    },
    [wallets, saveWallets],
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

  const setActiveWallet = useCallback(
    (index: number) => {
      if (index >= 0 && index < wallets.length) {
        setActiveWalletIndex(index);
        return true;
      }
      return false;
    },
    [wallets],
  );

  useEffect(() => {
    loadWallets();
    loadActiveChain();
  }, [loadWallets, loadActiveChain]);

  return {
    wallets,
    activeWallet,
    activeWalletIndex,
    isLoading,
    loadWallets,
    addWallet,
    updateWallet,
    removeWallet,
    setActiveWallet,
    activeChain,
    supportedChains,
    changeActiveChain,
  };
}

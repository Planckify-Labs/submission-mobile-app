import ActivitySection from "@/components/home/ActivitySection";
import BalanceSection from "@/components/home/BalanceSection";
import Header from "@/components/home/Header";
import PaymentSection from "@/components/home/PaymentSection";
import { useWallet } from "@/hooks/useWallet";
import { router } from "expo-router";
import { QrCode } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  const {
    wallets,
    isLoading,
    activeWallet,
    activeChain,
    getClientForActiveWallet,
    getPublicClientForActiveChain,
  } = useWallet();

  const readBlockchainData = useCallback(async () => {
    try {
      const publicClient = getPublicClientForActiveChain();

      const blockNumber = await publicClient.getBlockNumber();
      console.log("Current block number:", blockNumber);

      console.log(
        "Connected to chain:",
        activeChain.chain.name,
        "(ID:",
        activeChain.chain.id,
        ")",
      );

      if (activeWallet?.address) {
        const balance = await publicClient.getBalance({
          address: activeWallet.address as `0x${string}`,
        });
        console.log(
          "Wallet balance:",
          balance.toString(),
          activeChain.chain.nativeCurrency.symbol,
        );
      }
    } catch (error) {
      console.error("Error reading blockchain data:", error);
    }
  }, [getPublicClientForActiveChain, activeChain, activeWallet]);

  const prepareTransaction = useCallback(async () => {
    try {
      const walletClient = getClientForActiveWallet();
      if (!walletClient) {
        console.log("No wallet client available");
        return;
      }

      console.log("Wallet client ready for", activeWallet.address);
      console.log("Could send transaction with:", walletClient.account);

      const txParams = {
        to: "0x0000000000000000000000000000000000000000",
        value: 0n,
        data: "0x",
      };

      console.log("Transaction prepared:", txParams);
      console.log(
        "To send this transaction, you would call walletClient.sendTransaction(txParams)",
      );
    } catch (error) {
      console.error("Error preparing transaction:", error);
    }
  }, [getClientForActiveWallet, activeWallet]);

  useEffect(() => {
    if (!isLoading && wallets.length === 0) {
      router.replace("/login");
    }

    if (!isLoading && wallets.length > 0) {
      readBlockchainData();
      prepareTransaction();
    }
  }, [isLoading, wallets, readBlockchainData, prepareTransaction]);

  if (isLoading) {
    return null;
  }

  if (wallets.length === 0) {
    return null;
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6f9" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView
          className="bg-light-main-container flex-1"
          contentContainerStyle={{ gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 gap-4 p-4 pb-24">
            <Header />
            <BalanceSection />
            <ActivitySection />
            <PaymentSection />
          </View>
        </ScrollView>
        <View className="absolute bottom-2 justify-center items-center w-full">
          <Pressable className="bg-light-primary-red px-10 py-4 rounded-full flex-row items-center gap-2">
            <QrCode size={22} color="#fff" />
            <Text className="text-light font-bold text-2xl">Scan To Pay</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6f9",
  },
});

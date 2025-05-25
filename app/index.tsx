import LoadinngSpinnerPopup from "@/components/common/LoadinngSpinnerPopup";
import ActivitySection from "@/components/home/ActivitySection";
import BalanceSection from "@/components/home/BalanceSection";
import Header from "@/components/home/Header";
import PaymentSection from "@/components/home/PaymentSection";
import { useWallet } from "@/hooks/useWallet";
import { router } from "expo-router";
import { QrCode } from "lucide-react-native";
import React from "react";
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
  const { wallets, isLoading } = useWallet();

  React.useEffect(() => {
    if (!isLoading && wallets.length === 0) {
      const timeout = setTimeout(() => {
        router.replace("/login");
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, wallets.length]);

  if (isLoading || wallets.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LoadinngSpinnerPopup
          visible={true}
          title="Getting Ready"
          message="Please wait while we making sure you land safely on TakumiPay..."
        />
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6f9" />
      {!isLoading && wallets.length !== 0 && (
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
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6f9",
  },
});

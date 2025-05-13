import ActivitySection from "@/components/home/ActivitySection";
import BalanceSection from "@/components/home/BalanceSection";
import PaymentSection from "@/components/home/PaymentSection";
import { ShieldAlert, UserRound } from "lucide-react-native";
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
import { english, generateMnemonic, generatePrivateKey } from "viem/accounts";

export default function Home() {
  const privateKey = generatePrivateKey();
  console.log({ privateKey });

  const mnemonic = generateMnemonic(english);
  console.log({ mnemonic });
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView
          className="bg-light-main-container flex-1"
          contentContainerStyle={{ gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 gap-4 p-4 pb-24">
            <View className="flex-row gap-4 w-full">
              <View className="rounded-full bg-light p-2 px-4 gap-2 flex-1 flex-row items-center">
                <ShieldAlert color="#c71c4b" size={20} />
                <View className="border-l h-full max-h-7" />
                <Text numberOfLines={1} ellipsizeMode="tail" className="flex-1">
                  never share your private key or seed phrases
                </Text>
              </View>
              <View className="rounded-full bg-light p-1 aspect-square w-[45px] items-center justify-center">
                <UserRound color="#20222c" size={30} />
              </View>
            </View>
            <BalanceSection />
            <ActivitySection />
            <PaymentSection />
          </View>
        </ScrollView>
        <View className="absolute bottom-2 justify-center items-center w-full">
          <Pressable className="bg-light-primary-red px-10 py-4 rounded-full">
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
    backgroundColor: "#fff",
  },
});

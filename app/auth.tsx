import LoadinngSpinnerPopup from "@/components/common/LoadinngSpinnerPopup";
import PinConfirmationModal from "@/components/common/PinConfirmationModal";
import SignMessageModal from "@/components/common/SignMessageModal";
import { usePerformance } from "@/components/providers/PerformanceProvider";
import { useVerifySignature } from "@/hooks/queries/useAuth";
import useRQGlobalState from "@/hooks/useRQGlobalState";
import { useWallet } from "@/hooks/useWallet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface NonceData {
  message: string;
}

export default function AuthScreen() {
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [isStatementModalVisible, setIsStatementModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<
    {
      message: string;
      completed: boolean;
    }[]
  >([
    { message: "Preparing to sign message...", completed: false },
    { message: "Signing message with your wallet...", completed: false },
    { message: "Verifying signature...", completed: false },
    { message: "Authentication successful!", completed: false },
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const queryClient = useQueryClient();
  const { deferredTask } = usePerformance();

  const {
    activeWallet,
    activeChain,
    getClientForActiveWallet,
    getWalletAccount,
    activeWalletIndex,
  } = useWallet();

  const { data: nonceData } = useRQGlobalState<NonceData>({
    queryKey: ["auth", "nonce", activeWallet?.address, activeChain?.chain?.id],
    initialData: { message: "" },
  });

  const { mutateAsync: verifySignature } = useVerifySignature();

  const updateLoadingStep = useCallback((index: number, completed: boolean) => {
    setLoadingSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, completed } : step)),
    );
    setCurrentStepIndex(index);
  }, []);

  const createDelay = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }, []);

  const handleSignMessage = useCallback(
    async (pin: string) => {
      if (!nonceData?.message) {
        Alert.alert("Error", "Failed to get authentication message");
        return;
      }

      setIsPinModalVisible(false);
      setIsLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        updateLoadingStep(0, true);
        await createDelay(800);

        const walletClient = await deferredTask(() => {
          const client = getClientForActiveWallet();
          if (!client) {
            throw new Error("Unable to initialize wallet client");
          }
          return client;
        }, "Initializing wallet client");

        const account = await deferredTask(async () => {
          const acc = await getWalletAccount(activeWalletIndex);
          if (!acc) {
            throw new Error("Wallet account not properly configured");
          }
          return acc;
        }, "Getting wallet account");

        updateLoadingStep(1, true);

        const signature = await deferredTask(async () => {
          return await walletClient.signMessage({
            account,
            message: nonceData.message,
          });
        }, "Signing message");

        updateLoadingStep(2, true);
        await createDelay(800);

        await deferredTask(async () => {
          await verifySignature({
            message: nonceData.message,
            signature,
          });

          queryClient.invalidateQueries({ queryKey: ["auth"] });
        }, "Verifying signature");

        updateLoadingStep(3, true);
        await createDelay(1000);

        router.replace("/");
      } catch (error: any) {
        console.error("Authentication error:", error);
        setIsLoading(false);
        Alert.alert(
          "Authentication Failed",
          error?.message || "Failed to authenticate with wallet",
        );
      }
    },
    [
      nonceData,
      getClientForActiveWallet,
      getWalletAccount,
      activeWalletIndex,
      verifySignature,
      queryClient,
      deferredTask,
      updateLoadingStep,
      createDelay,
    ],
  );

  const startAuthentication = useCallback(() => {
    if (!activeWallet?.address) {
      Alert.alert("Error", "No wallet selected");
      return;
    }

    AsyncStorage.getItem(`auth_remember_choice_${activeWallet.address}`)
      .then((value) => {
        if (value === "true") {
          setIsPinModalVisible(true);
        } else {
          setIsStatementModalVisible(true);
        }
      })
      .catch(() => {
        setIsStatementModalVisible(true);
      });
  }, [activeWallet?.address]);

  const handleStatementConfirm = useCallback(
    async (rememberChoice: boolean) => {
      setIsStatementModalVisible(false);

      if (rememberChoice && activeWallet?.address) {
        await AsyncStorage.setItem(
          `auth_remember_choice_${activeWallet.address}`,
          "true",
        );
      }

      setIsPinModalVisible(true);
    },
    [activeWallet?.address],
  );

  return (
    <SafeAreaView className="flex-1 bg-light-main-container">
      <View className="flex-row items-center p-4">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-light-main-container"
        >
          <ArrowLeft size={24} color="#20222c" />
        </Pressable>
        <Text className="text-xl font-bold text-light-matte-black ml-2">
          Sign In With Ethereum
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <View className="items-center mb-6">
            <Image
              source={require("@/assets/images/takumipay-logo.png")}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
          </View>

          <Text className="text-light-matte-black text-lg font-bold mb-2 text-center">
            Secure Authentication
          </Text>

          <Text className="text-light-matte-black/70 text-center mb-6">
            Sign a message with your Ethereum wallet to securely authenticate
            with TakumiPay
          </Text>

          <View className="bg-light-main-container p-4 rounded-xl mb-6">
            <Text className="text-light-matte-black/70 mb-2">
              Active Wallet
            </Text>
            <Text className="text-light-matte-black font-medium">
              {activeWallet?.name || "My Wallet"}
            </Text>
            <Text className="text-light-matte-black/60 text-xs">
              {activeWallet?.address
                ? `${activeWallet.address.substring(0, 8)}...${activeWallet.address.substring(
                    activeWallet.address.length - 6,
                  )}`
                : "No wallet selected"}
            </Text>
            <Text className="text-light-matte-black/60 text-xs mt-2">
              Network: {activeChain?.chain?.name || "Unknown"}
            </Text>
          </View>

          {!isLoading ? (
            <Pressable
              className="bg-light-primary-red py-4 rounded-xl items-center"
              onPress={startAuthentication}
            >
              <Text className="text-white font-bold">Sign In With Wallet</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-light-matte-black font-bold mb-2">
            How it works
          </Text>
          <Text className="text-light-matte-black/70 mb-2">
            1. Confirm your identity with your PIN
          </Text>
          <Text className="text-light-matte-black/70 mb-2">
            2. Sign a unique message with your wallet (no gas fees)
          </Text>
          <Text className="text-light-matte-black/70 mb-2">
            3. Our server verifies your signature
          </Text>
          <Text className="text-light-matte-black/70">
            4. You're securely authenticated!
          </Text>
        </View>
      </ScrollView>

      <SignMessageModal
        visible={isStatementModalVisible}
        onClose={() => setIsStatementModalVisible(false)}
        onConfirm={handleStatementConfirm}
      />

      <PinConfirmationModal
        visible={isPinModalVisible}
        onClose={() => setIsPinModalVisible(false)}
        onConfirm={handleSignMessage}
        title="Confirm Authentication"
      />

      <LoadinngSpinnerPopup
        visible={isLoading}
        title="Authenticating"
        message={loadingSteps[currentStepIndex]?.message}
      />
    </SafeAreaView>
  );
}

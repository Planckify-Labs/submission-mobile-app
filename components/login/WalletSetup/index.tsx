import { createWalletSteps } from "@/constants/walletSetup/walletCreationStepList";
import { useWallet } from "@/hooks/useWallet";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { english, generateMnemonic } from "viem/accounts";
import WalletSetupSteps from "./WalletSetupSteps";

export default function WalletSetup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isChecked, setIsChecked] = useState(false);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<{ [key: number]: string }>(
    {},
  );
  const [wordOptions, setWordOptions] = useState<{ [key: number]: string[] }>(
    {},
  );

  const verificationIndices = [1, 3, 7, 11];

  useEffect(() => {
    const generatedMnemonic = generateMnemonic(english).split(" ");
    setMnemonic(generatedMnemonic);

    const options: { [key: number]: string[] } = {};
    verificationIndices.forEach((index) => {
      options[index] = getWordOptions(generatedMnemonic, index);
    });
    setWordOptions(options);
  }, []);

  const getWordOptions = (mnemonicWords: string[], wordIndex: number) => {
    const correctWord = mnemonicWords[wordIndex];
    if (!correctWord) return [];

    const otherWords = mnemonicWords
      .filter((_, i) => i !== wordIndex)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    return [correctWord, ...otherWords].sort(() => 0.5 - Math.random());
  };

  const handleSelectWord = useCallback((wordIndex: number, word: string) => {
    setSelectedWords((prev) => ({
      ...prev,
      [wordIndex]: word,
    }));
  }, []);

  const { addWallet } = useWallet();

  const finalizeWalletSetup = useCallback(async () => {
    const mnemonicString = mnemonic.join(" ");

    try {
      const success = await addWallet({
        source: "SeedPhrase",
        seedPhrase: mnemonicString,
        name: "My Wallet",
      });

      if (success) {
        setTimeout(() => {
          router.replace("/");
        }, 500);
      } else {
        Alert.alert("Error", "Failed to create wallet");
      }
    } catch (error) {
      console.error("Wallet creation error:", error);
      Alert.alert(
        "Error",
        "An unexpected error occurred while creating the wallet",
      );
    }
  }, [mnemonic, addWallet]);

  const steps = createWalletSteps(
    mnemonic,
    setCurrentStep,
    isChecked,
    setIsChecked,
    verificationIndices,
    wordOptions,
    selectedWords,
    handleSelectWord,
  );

  if (steps.length > 0) {
    const lastStepIndex = steps.length - 1;
    const lastStep = steps[lastStepIndex];
    steps[lastStepIndex] = {
      ...lastStep,
      onButtonPress: finalizeWalletSetup,
    };
  }

  const handleBackPress = () => {
    if (currentStep === 0) {
      router.back();
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <WalletSetupSteps
          currentStep={currentStep}
          steps={steps}
          onBackPress={handleBackPress}
        />
      </SafeAreaView>
    </>
  );
}

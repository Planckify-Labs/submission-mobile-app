import { ArrowLeft } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

type WalletSetupStep = {
  title: string;
  content: React.ReactNode;
  buttonText: string;
  onButtonPress: () => void;
};

type WalletSetupStepsProps = {
  currentStep: number;
  steps: WalletSetupStep[];
  onBackPress: () => void;
};

export default function WalletSetupSteps({
  currentStep,
  steps,
  onBackPress,
}: WalletSetupStepsProps) {
  const currentStepData = steps[currentStep];

  return (
    <View className="flex-1 p-6">
      <View className="flex-row gap-2 mb-6">
        {steps.map((_, index) => (
          <View
            key={index}
            className={`h-1 flex-1 ${
              index <= currentStep ? "bg-light-primary-red" : "bg-gray-300"
            } rounded-full`}
          />
        ))}
      </View>

      <Pressable onPress={onBackPress} className="mb-6">
        <ArrowLeft color="#c71c4b" size={24} />
      </Pressable>

      <View className="flex-1">
        <Text className="text-light-matte-black text-3xl font-bold mb-4">
          {currentStepData.title}
        </Text>

        {currentStepData.content}
      </View>

      <Pressable
        className="bg-light-primary-red py-4 rounded-full items-center mb-6 shadow-sm"
        onPress={currentStepData.onButtonPress}
      >
        <Text className="text-light font-bold text-lg">
          {currentStepData.buttonText}
        </Text>
      </Pressable>
    </View>
  );
}


import { ArrowLeft } from "lucide-react-native";
import React, { memo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { TWalletSetupStepsProps } from "@/constants/types/walletTypes";

const WalletSetupSteps = memo(function WalletSetupSteps({
  currentStep,
  steps,
  onBackPress,
  disableBackButton = false,
}: TWalletSetupStepsProps) {
  if (steps.length === 0) {
    return null;
  }

  const currentStepContent = steps[currentStep];

  return (
    <View className="flex-1">
      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={false}
        className="flex-1 p-6"
      >
        <StepProgressIndicator
          totalStepCount={steps.length}
          activeStepIndex={currentStep}
        />

        <NavigationBackButton
          onPress={onBackPress}
          isDisabled={disableBackButton}
        />

        <View className="flex-1">
          <Text className="text-light-matte-black text-3xl font-bold mb-4">
            {currentStepContent.title}
          </Text>

          {currentStepContent.content}
        </View>
      </ScrollView>
      <StepActionButton
        buttonText={currentStepContent.buttonText}
        onPress={currentStepContent.onButtonPress}
        isDisabled={disableBackButton}
      />
    </View>
  );
});

const StepProgressIndicator = ({
  totalStepCount,
  activeStepIndex,
}: {
  totalStepCount: number;
  activeStepIndex: number;
}) => (
  <View className="flex-row gap-2 mb-6">
    {Array.from({ length: totalStepCount }).map((_, stepIndex) => (
      <View
        key={stepIndex}
        className={`h-1 flex-1 ${
          stepIndex <= activeStepIndex ? "bg-light-primary-red" : "bg-gray-300"
        } rounded-full`}
      />
    ))}
  </View>
);

const NavigationBackButton = ({
  onPress,
  isDisabled,
}: {
  onPress: () => void;
  isDisabled: boolean;
}) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    className={`mb-6 ${isDisabled ? "opacity-30" : ""}`}
    disabled={isDisabled}
  >
    <ArrowLeft color="#c71c4b" size={24} />
  </TouchableOpacity>
);

const StepActionButton = ({
  buttonText,
  onPress,
  isDisabled,
}: {
  buttonText: string;
  onPress: () => void;
  isDisabled: boolean;
}) => (
  <View className="p-6 bg-light-main-container">
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isDisabled}
      className={`bg-light-primary-red py-4 rounded-full items-center ${
        isDisabled ? "opacity-70" : ""
      }`}
    >
      <Text className="text-light font-bold text-lg">{buttonText}</Text>
    </TouchableOpacity>
  </View>
);

export default WalletSetupSteps;

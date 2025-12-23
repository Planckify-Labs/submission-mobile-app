import { router } from "expo-router";
import React, { useCallback } from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PackageVariantList,
  PhoneNumberInput,
  ProviderNotDetectedAlert,
  ScreenHeader,
} from "@/components/pulsa-data";

export default function PulsaDataScreen() {
  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <View className="flex-1 px-6">
          <ScreenHeader title="Pulsa & Data Package" onBackPress={handleGoBack} />

          <PhoneNumberInput />

          <ProviderNotDetectedAlert />

          <View className="flex-1">
            <PackageVariantList />
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

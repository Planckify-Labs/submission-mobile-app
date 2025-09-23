import React from "react";
import { StatusBar } from "react-native";
import WalletSetup from "@/components/login/WalletSetup";

export default function WalletSetupScreen() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <WalletSetup />
    </>
  );
}

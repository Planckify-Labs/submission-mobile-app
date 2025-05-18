import WalletSetup from "@/components/login/WalletSetup";
import React from "react";
import { StatusBar } from "react-native";

export default function WalletSetupScreen() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <WalletSetup />
    </>
  );
}
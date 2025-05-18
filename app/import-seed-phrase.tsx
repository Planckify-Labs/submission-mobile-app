import ImportWallet from "@/components/login/ImportSeedPhrase";
import React from "react";
import { StatusBar } from "react-native";

export default function ImportWalletScreen() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ImportWallet />
    </>
  );
}

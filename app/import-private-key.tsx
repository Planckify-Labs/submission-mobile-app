import ImportPrivateKey from "@/components/login/ImportPrivateKey";
import React from "react";
import { StatusBar } from "react-native";

export default function ImportPrivateKeyScreen() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ImportPrivateKey />
    </>
  );
}
import ItemWithoutInput from "@/components/purchase-item/ItemVariantWithoutInput";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PurchaseItemScreen() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        {/* <ItemWithInput />  */}
        <ItemWithoutInput />
      </SafeAreaView>
    </>
  );
}

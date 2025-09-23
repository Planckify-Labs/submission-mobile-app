import React from "react";
import { View } from "react-native";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";

const NetworkRadioButtonLoadingSkeletons = () => {
  return (
    <>
      <View className="px-3 py-2 rounded-full mx-1 flex-row items-center bg-light-main-container">
        <SingleLoadingSekeleton width={80} height={24} borderRadius={12} />
      </View>
      <View className="px-3 py-2 rounded-full mx-1 flex-row items-center bg-light-main-container">
        <SingleLoadingSekeleton width={90} height={24} borderRadius={12} />
      </View>
      <View className="px-3 py-2 rounded-full mx-1 flex-row items-center bg-light-main-container">
        <SingleLoadingSekeleton width={70} height={24} borderRadius={12} />
      </View>
    </>
  );
};

export default NetworkRadioButtonLoadingSkeletons;

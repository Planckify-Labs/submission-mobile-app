import { BlurView } from "expo-blur";
import React from "react";
import {
  Animated,
  LayoutChangeEvent,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type CategoryTab = "dex" | "defi" | "gaming";

interface FloatingDAppsCategoryTabProps {
  activeCategory: CategoryTab;
  onTabChange: (tab: CategoryTab) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  tabWidth: number;
  horizontalScrollX: Animated.Value;
}

export default function DAppsCategoryTab({
  activeCategory,
  onTabChange,
  onLayout,
  tabWidth,
  horizontalScrollX,
}: FloatingDAppsCategoryTabProps) {
  const tabs = [
    { id: "dex" as const, label: "DEX" },
    { id: "defi" as const, label: "DeFi" },
    { id: "gaming" as const, label: "Games" },
  ];

  return (
    <BlurView
      intensity={30}
      experimentalBlurMethod="dimezisBlurView"
      className="overflow-hidden rounded-full absolute bottom-4 left-0 right-0 mx-4 border-4 border-light-main-container/80"
    >
      <View
        className="bg-mainborder-light-main-container/10 w-full flex-row items-center relative"
        onLayout={onLayout}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            activeOpacity={0.7}
            className="flex-1 py-2 items-center justify-center"
          >
            <Text
              className={`${activeCategory === tab.id ? "text-light-primary-red/75" : "text-light-matte-black/50"} text-center font-bold text-xs`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}

        <Animated.View
          className="absolute bottom-0 h-1 bg-light-primary-red/75 left-0 right-0 rounded-t-md"
          style={{
            width: tabWidth,
            transform: [
              {
                translateX: horizontalScrollX.interpolate({
                  inputRange: [
                    0,
                    require("react-native").Dimensions.get("window").width,
                    require("react-native").Dimensions.get("window").width * 2,
                  ],
                  outputRange: [0, tabWidth, tabWidth * 2],
                  extrapolate: "clamp",
                }),
              },
            ],
          }}
        />
      </View>
    </BlurView>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";

type SingleLoadingSkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
};

export default function SingleLoadingSekeleton({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}: SingleLoadingSkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0.0, 0.6, 1),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1200,
          easing: Easing.bezier(0.4, 0.0, 0.6, 1),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange:
      containerWidth > 0
        ? [-containerWidth / 2, containerWidth / 2]
        : [-50, 50],
  });

  const containerStyle = {
    width: width as any,
    height: height as any,
    borderRadius,
  };

  return (
    <View
      style={[styles.container, containerStyle, style]}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: containerWidth * 2,
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            height: "100%",
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#E0E0E0",
    overflow: "hidden",
  },
});

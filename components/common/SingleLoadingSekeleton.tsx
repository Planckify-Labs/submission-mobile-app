import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const containerStyle = useMemo(
    () => ({
      width: width as any,
      height: height as any,
      borderRadius,
    }),
    [width, height, borderRadius],
  );

  const translateX = useMemo(
    () =>
      animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange:
          containerWidth > 0
            ? [-containerWidth / 2, containerWidth / 2]
            : [-50, 50],
      }),
    [animatedValue, containerWidth],
  );

  const animatedViewStyle = useMemo(
    () => [
      StyleSheet.absoluteFill,
      {
        width: containerWidth * 2,
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        height: "100%" as const,
        transform: [{ translateX }],
      } as any,
    ],
    [containerWidth, translateX],
  );

  const onLayout = useCallback((event: any) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }

    animationRef.current = Animated.loop(
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
    );

    animationRef.current.start();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []);

  return (
    <View style={[styles.container, containerStyle, style]} onLayout={onLayout}>
      <Animated.View style={animatedViewStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#E0E0E0",
    overflow: "hidden",
  },
});

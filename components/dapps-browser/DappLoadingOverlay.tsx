import { Image } from "expo-image";
import React, { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const BRAND_RED = "#c71c4b";
const MATTE_BLACK = "#20222c";
const RING_SIZE = 92;
const LOGO_SIZE = 40;
const HALO_SIZE = RING_SIZE + 28;

type DappLoadingOverlayProps = {
  // Bare hostname of the page being loaded (e.g. "jup.ag"). Optional so
  // the loader still renders cleanly before we have a URL.
  host?: string;
};

// Branded loading state shown over the WebView while a dApp boots. The
// Takumi "P" mark breathes inside a spinning brand-red arc with a soft
// halo, so the blank white first paint reads as "us loading" instead of
// a stalled page. Purely decorative — no data, no error text.
const DappLoadingOverlay = memo<DappLoadingOverlayProps>(
  function DappLoadingOverlay({ host }) {
    const spin = useSharedValue(0);
    const pulse = useSharedValue(0);

    useEffect(() => {
      spin.value = withRepeat(
        withTiming(1, { duration: 1100, easing: Easing.linear }),
        -1,
        false,
      );
      pulse.value = withRepeat(
        withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }, [spin, pulse]);

    const ringStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${spin.value * 360}deg` }],
    }));

    const logoStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.06]) }],
    }));

    const haloStyle = useAnimatedStyle(() => ({
      opacity: interpolate(pulse.value, [0, 1], [0.08, 0.22]),
      transform: [{ scale: interpolate(pulse.value, [0, 1], [0.85, 1.1]) }],
    }));

    return (
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.stage}>
          <Animated.View style={[styles.halo, haloStyle]} />
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={logoStyle}>
            <Image
              source={require("@/assets/images/takumipay-no-bg.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </Animated.View>
        </View>
        {host ? (
          <Text style={styles.host} numberOfLines={1}>
            Loading {host}
          </Text>
        ) : null}
      </View>
    );
  },
);

export default DappLoadingOverlay;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f5f6f9",
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: BRAND_RED,
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: "rgba(199,28,75,0.12)",
    borderTopColor: BRAND_RED,
    borderRightColor: BRAND_RED,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  host: {
    marginTop: 22,
    maxWidth: 220,
    color: MATTE_BLACK,
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.5,
  },
});

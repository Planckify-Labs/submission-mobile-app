/**
 * Screenshot prevention for sensitive screens.
 * Android: FLAG_SECURE. iOS: screenshot notification.
 */

import { useEffect } from "react";
import { Platform, Alert } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

export function useScreenshotGuard(active: boolean = true) {
  useEffect(() => {
    if (!active) return;

    if (Platform.OS === "android") {
      ScreenCapture.preventScreenCaptureAsync();
      return () => {
        ScreenCapture.allowScreenCaptureAsync();
      };
    }

    if (Platform.OS === "ios") {
      const subscription = ScreenCapture.addScreenshotListener(() => {
        Alert.alert(
          "Screenshot Detected",
          "Your sensitive information may have been captured. " +
            "Please delete the screenshot to protect your wallet security.",
          [{ text: "OK" }],
        );
      });
      return () => {
        subscription.remove();
      };
    }
  }, [active]);
}

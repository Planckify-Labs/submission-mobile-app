import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  InteractionManager,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import HomeMain from "@/components/home/Main/HomeMain";
import ScanToPayChatModeFloatingButtons from "@/components/home/Main/ScanToPayChatModeFloatingButtons";
import AgentMode from "@/components/home/TakumiAgent/AgentMode";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function Home() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Track if agent mode has ever been opened to keep it mounted once visited
  const [hasVisitedAgentMode, setHasVisitedAgentMode] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    scrollViewRef.current?.scrollTo({
      x: SCREEN_WIDTH * index,
      animated: true,
    });
    setCurrentIndex(index);
  }, []);

  const handleChatModePress = () => {
    scrollToIndex(1);
  };

  // Pre-warm AgentMode shortly after the home screen idles. Mounting it
  // on-press makes the swipe feel laggy — the heavy useWallet /
  // useBlockchainsWithStorage / FlashList boot cost lands in the same
  // frame as the animation start. Defer to after first interactions so
  // the initial home paint stays cheap, then let AgentMode hydrate in
  // the background so tapping chat mode is instant.
  useEffect(() => {
    if (hasVisitedAgentMode) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setHasVisitedAgentMode(true);
    });
    return () => task.cancel();
  }, [hasVisitedAgentMode]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (currentIndex === 1) {
          scrollToIndex(0);
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, [currentIndex, scrollToIndex]);

  const { bottom } = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? 0 : bottom > 0 ? bottom : 0;
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6f9" />
      <SafeAreaView style={[styles.container]} edges={["top"]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal={true}
          scrollEnabled={false}
          pagingEnabled={true}
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={{ paddingBottom: bottomOffset }}
        >
          <View style={{ width: SCREEN_WIDTH }}>
            <HomeMain />
          </View>
          <View style={{ width: SCREEN_WIDTH }}>
            {hasVisitedAgentMode && <AgentMode />}
          </View>
        </ScrollView>

        {currentIndex === 0 && (
          <ScanToPayChatModeFloatingButtons
            onChatModePress={handleChatModePress}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6f9",
  },
  horizontalScroll: {
    flex: 1,
  },
});

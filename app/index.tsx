import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
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
            <AgentMode />
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

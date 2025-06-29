import ActivityHeader from "@/components/activities/ActivityHeader";
import PurchaseCard from "@/components/activities/PurchaseCard";
import PurchaseCardSkeleton from "@/components/activities/PurchaseCardSkeleton";
import TransferCard from "@/components/activities/TransferCard";
import TransferCardSkeleton from "@/components/activities/TransferCardSkeleton";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PURCHASE_DATA = Array.from({ length: 15 }).map((_, i) => ({
  id: `purchase-${i}`,
}));

const TRANSFER_DATA = Array.from({ length: 15 }).map((_, i) => ({
  id: `transfer-${i}`,
}));

const SKELETON_DATA = Array.from({ length: 5 }).map((_, index) => ({
  id: `skeleton-${index}`,
}));

const CONTENT_CONTAINER_STYLE = {
  paddingHorizontal: 16,
  paddingVertical: 70,
};

const ItemSeparator = React.memo(() => <View className="h-4" />);

const SkeletonSeparator = React.memo(() => <View className="h-4" />);

const { width } = Dimensions.get("window");

export default function ActivitiesScreen() {
  const [activeActivity, setActiveActivity] = useState<
    "purchase" | "transfers"
  >("purchase");
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchaseLoading, setIsPurchaseLoading] = useState(true);
  const [isTransferLoading, setIsTransferLoading] = useState(true);
  const horizontalScrollRef = useRef<FlatList>(null);

  const tabIndicatorPosition = useRef(
    new Animated.Value(activeActivity === "purchase" ? 1 : 0),
  ).current;

  const horizontalScrollX = useRef(
    new Animated.Value(activeActivity === "purchase" ? width : 0),
  ).current;

  const currentTabIndex = useRef(activeActivity === "purchase" ? 1 : 0);

  const renderPurchaseItem = useCallback(() => {
    return isPurchaseLoading ? <PurchaseCardSkeleton /> : <PurchaseCard />;
  }, [isPurchaseLoading]);

  const renderTransferItem = useCallback(() => {
    return isTransferLoading ? <TransferCardSkeleton /> : <TransferCard />;
  }, [isTransferLoading]);

  const keyExtractor = useCallback((item: { id: string }) => item.id, []);

  const searchPlaceholder = useMemo(
    () => `search ${activeActivity}...`,
    [activeActivity],
  );

  const handleTabChange = useCallback(
    (newTab: "purchase" | "transfers") => {
      if (newTab !== activeActivity) {
        setActiveActivity(newTab);

        Animated.spring(tabIndicatorPosition, {
          toValue: newTab === "purchase" ? 1 : 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }).start();

        const indexToScroll = newTab === "purchase" ? 1 : 0;
        horizontalScrollRef.current?.scrollToIndex({
          index: indexToScroll,
          animated: true,
        });
      }
    },
    [activeActivity, tabIndicatorPosition],
  );

  useEffect(() => {
    const purchaseTimer = setTimeout(() => {
      setIsPurchaseLoading(false);
    }, 12000);

    const transferTimer = setTimeout(() => {
      setIsTransferLoading(false);
    }, 12000);

    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
    }, 12000);

    return () => {
      clearTimeout(purchaseTimer);
      clearTimeout(transferTimer);
      clearTimeout(loadingTimer);
    };
  }, []);

  const scrollY = useRef(new Animated.Value(0)).current;

  const searchBarOpacity = scrollY.interpolate({
    inputRange: [50, 150],
    outputRange: [1, 0.2],
    extrapolate: "clamp",
  });

  const PurchaseList = useMemo(() => {
    const data = isPurchaseLoading ? SKELETON_DATA : PURCHASE_DATA;
    const SeparatorComponent = isPurchaseLoading
      ? SkeletonSeparator
      : ItemSeparator;

    return (
      <FlashList
        data={data}
        estimatedItemSize={30}
        keyExtractor={keyExtractor}
        renderItem={renderPurchaseItem}
        ItemSeparatorComponent={SeparatorComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
        removeClippedSubviews={true}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      />
    );
  }, [isPurchaseLoading, keyExtractor, renderPurchaseItem]);

  const TransferList = useMemo(() => {
    const data = isTransferLoading ? SKELETON_DATA : TRANSFER_DATA;
    const SeparatorComponent = isTransferLoading
      ? SkeletonSeparator
      : ItemSeparator;

    return (
      <FlashList
        data={data}
        estimatedItemSize={30}
        keyExtractor={keyExtractor}
        renderItem={renderTransferItem}
        ItemSeparatorComponent={SeparatorComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
        removeClippedSubviews={true}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
      />
    );
  }, [isTransferLoading, keyExtractor, renderTransferItem]);

  const renderTabContent = useCallback(
    ({ index }: { index: number }) => {
      return (
        <View style={{ width }}>
          {index === 0 ? TransferList : PurchaseList}
        </View>
      );
    },
    [TransferList, PurchaseList],
  );

  const handleHorizontalScroll = useCallback(
    (event: any) => {
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(contentOffsetX / width);

      if (currentTabIndex.current !== newIndex) {
        currentTabIndex.current = newIndex;
        setActiveActivity(newIndex === 0 ? "transfers" : "purchase");

        Animated.spring(tabIndicatorPosition, {
          toValue: newIndex,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }).start();
      }
    },
    [tabIndicatorPosition],
  );

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: horizontalScrollX } } }],
    { useNativeDriver: false },
  );

  const TabButtons = useMemo(
    () => (
      <BlurView
        intensity={30}
        experimentalBlurMethod="dimezisBlurView"
        className="overflow-hidden rounded-full absolute bottom-4 left-0 right-0 mx-4 border-4 border-light-main-container/80"
      >
        <View className="bg-mainborder-light-main-container/10 w-full flex-row items-center justify-evenly relative">
          <TouchableOpacity
            onPress={() => handleTabChange("transfers")}
            activeOpacity={0.7}
            className="px-8 py-2 items-center justify-center grow"
          >
            <Text
              className={`${activeActivity !== "purchase" ? "text-light-primary-red/75" : "text-light-matte-black/50"} text-center font-bold`}
            >
              Transfers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange("purchase")}
            activeOpacity={0.7}
            className="px-8 py-2 items-center justify-center grow"
          >
            <Text
              className={`${activeActivity === "purchase" ? "text-light-primary-red/75" : "text-light-matte-black/50"} text-center font-bold`}
            >
              Purchase
            </Text>
          </TouchableOpacity>

          <Animated.View
            className="absolute bottom-0 h-1 bg-light-primary-red/75 left-0 right-0 rounded-t-md"
            style={{
              width: "50%",
              transform: [
                {
                  translateX: horizontalScrollX.interpolate({
                    inputRange: [0, width],
                    outputRange: [0, width / 2],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          />
        </View>
      </BlurView>
    ),
    [activeActivity, handleTabChange, horizontalScrollX],
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        className="flex-1 bg-light-main-container relative"
        edges={["top"]}
      >
        <View className="flex-1 relative">
          <ActivityHeader
            placeholder={searchPlaceholder}
            searchBarOpacity={searchBarOpacity}
          />
          <FlatList
            ref={horizontalScrollRef}
            data={[{ id: "transfers" }, { id: "purchase" }]}
            renderItem={renderTabContent}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activeActivity === "purchase" ? 1 : 0}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onMomentumScrollEnd={handleHorizontalScroll}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        </View>
        {TabButtons}
      </SafeAreaView>
    </>
  );
}

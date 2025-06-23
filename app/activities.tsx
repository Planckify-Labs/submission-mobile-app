import ActivityHeader from "@/components/activities/ActivityHeader";
import PurchaseCard from "@/components/activities/PurchaseCard";
import PurchaseCardSkeleton from "@/components/activities/PurchaseCardSkeleton";
import TransferCard from "@/components/activities/TransferCard";
import TransferCardSkeleton from "@/components/activities/TransferCardSkeleton";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PURCHASE_DATA = Array.from({ length: 60 }).map((_, i) => ({
  id: `purchase-${i}`,
}));

const TRANSFER_DATA = Array.from({ length: 60 }).map((_, i) => ({
  id: `transfer-${i}`,
}));

const SKELETON_DATA = Array.from({ length: 5 }).map((_, index) => ({
  id: `skeleton-${index}`,
}));

const CONTENT_CONTAINER_STYLE = {
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 96,
};

const ItemSeparator = React.memo(() => <View className="h-4" />);

const SkeletonSeparator = React.memo(() => <View className="h-4" />);

export default function ActivitiesScreen() {
  const [activeActivity, setActiveActivity] = useState<
    "purchase" | "transfers"
  >("purchase");
  const [isLoading, setIsLoading] = useState(true);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (isLoading) {
        return activeActivity === "purchase" ? (
          <PurchaseCardSkeleton />
        ) : (
          <TransferCardSkeleton />
        );
      }
      return activeActivity === "purchase" ? (
        <PurchaseCard />
      ) : (
        <TransferCard />
      );
    },
    [activeActivity, isLoading],
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  const searchPlaceholder = useMemo(
    () => `search ${activeActivity}...`,
    [activeActivity],
  );

  const handleTabChange = useCallback(
    (newTab: "purchase" | "transfers") => {
      if (newTab !== activeActivity) {
        setIsLoading(true);
        setActiveActivity(newTab);

        setTimeout(() => {
          setIsLoading(false);
        }, 12000);
      }
    },
    [activeActivity],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 12000);

    return () => clearTimeout(timer);
  }, []);

  const ActivityList = useMemo(() => {
    const data = isLoading
      ? SKELETON_DATA
      : activeActivity === "purchase"
        ? PURCHASE_DATA
        : TRANSFER_DATA;
    const SeparatorComponent = isLoading ? SkeletonSeparator : ItemSeparator;

    return (
      <FlashList
        data={data}
        estimatedItemSize={60}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={SeparatorComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
        removeClippedSubviews={true}
      />
    );
  }, [isLoading, activeActivity, keyExtractor, renderItem]);

  const TabButtons = useMemo(
    () => (
      <BlurView
        intensity={30}
        experimentalBlurMethod="dimezisBlurView"
        className="overflow-hidden rounded-full absolute bottom-4 left-0 right-0 mx-4 border-4 border-light-main-container/80"
      >
        <View className="bg-mainborder-light-main-container/10 w-full flex-row items-center justify-evenly">
          <TouchableOpacity
            onPress={() => handleTabChange("transfers")}
            activeOpacity={0.7}
            className={`px-8 border-b-4 ${activeActivity !== "purchase" ? "border-light-primary-red/75" : "border-light-matte-black/10"} py-2 items-center justify-center grow`}
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
            className={`px-8 border-b-4 ${activeActivity === "purchase" ? "border-light-primary-red/75" : "border-light-matte-black/10"} py-2 items-center justify-center grow`}
          >
            <Text
              className={`${activeActivity === "purchase" ? "text-light-primary-red/75" : "text-light-matte-black/50"} text-center font-bold`}
            >
              Purchase
            </Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    ),
    [activeActivity, handleTabChange],
  );

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        className="flex-1 bg-light-main-container relative"
        edges={["top"]}
      >
        <View className="flex-1">
          <ActivityHeader placeholder={searchPlaceholder} />
          {ActivityList}
        </View>
        {TabButtons}
      </SafeAreaView>
    </>
  );
}

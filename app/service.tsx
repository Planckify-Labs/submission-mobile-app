import PaymentHeader from "@/components/payment/PaymentHeader";
import PaymentSectionContainer from "@/components/payment/PaymentSectionContainer";
import PromotionBanner from "@/components/payment/PromotionBanner";
import SearchBar from "@/components/payment/SearchBar";
import {
  type ListItemData as ListItem,
  createPaymentListData,
} from "@/constants/dummyData/paymentScreen";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ListRenderItemInfo,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ServiceScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const scrollY = useRef(new Animated.Value(0)).current;

  const searchBarOpacity = scrollY.interpolate({
    inputRange: [50, 150],
    outputRange: [1, 0.2],
    extrapolate: "clamp",
  });

  const listData = createPaymentListData(searchQuery, setSearchQuery);

  const renderListItem = ({ item }: ListRenderItemInfo<ListItem>) => {
    if (item.type === "header") {
      return <PaymentHeader title="Payments" />;
    } else if (item.type === "searchBar") {
      return (
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchBarOpacity={searchBarOpacity}
        />
      );
    } else if (item.type === "banner") {
      return (
        <PromotionBanner
          title={item.data.title}
          description={item.data.description}
          buttonText={item.data.buttonText}
          onPress={item.data.onPress}
        />
      );
    } else {
      return <PaymentSectionContainer section={item.data} />;
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <FlatList
          data={listData}
          renderItem={renderListItem}
          keyExtractor={(item, index) =>
            item.type === "section" ? item.data.id : `${item.type}-${index}`
          }
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: 24 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        />
      </SafeAreaView>
    </>
  );
}

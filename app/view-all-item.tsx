import { TProduct } from "@/api/types/product";
import OptimizedImage from "@/components/common/OptimizedImage";
import SearchBar from "@/components/common/SearchBar";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";
import { useProductsByCategories } from "@/hooks/queries/useProducts";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Animated, Pressable, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type THeaderItem = {
  type: "header";
  title: string;
};

type TSearchBarItem = {
  type: "searchBar";
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
};

type TItemsItem = {
  type: "items";
  products: TProduct[];
};

type TListItem = THeaderItem | TSearchBarItem | TItemsItem;

const SkeletonItem = () => (
  <View className="items-center justify-center p-1">
    <SingleLoadingSekeleton
      width={64}
      height={64}
      borderRadius={16}
      style={{ marginBottom: 4 }}
    />
    <SingleLoadingSekeleton
      width={48}
      height={10}
      borderRadius={4}
      style={{ alignSelf: "center" }}
    />
  </View>
);

const LoadingSkeletons = () => {
  const skeletonItems = Array.from({ length: 12 }, (_, index) =>
    index.toString(),
  );

  return (
    <View className="px-4">
      <View className="w-full" style={{ minHeight: 300 }}>
        <FlashList
          data={skeletonItems}
          renderItem={() => <SkeletonItem />}
          keyExtractor={(item) => item}
          estimatedItemSize={20}
          numColumns={4}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const ProductItem = ({
  product,
  router,
}: { product: TProduct; router: any }) => (
  <Pressable
    onPress={() =>
      router.push({
        pathname: "/purchase-item",
        params: { productId: product.id },
      })
    }
    className="items-center justify-center p-1"
  >
    {product.imageUrl ? (
      <View className="rounded-2xl overflow-hidden w-16 h-16 border-2 border-light-matte-black bg-light-primary-red/40">
        <OptimizedImage
          source={{ uri: product.imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
        />
      </View>
    ) : (
      <View className="rounded-2xl border-2 border-light-matte-black w-16 aspect-square bg-light-primary-red/40" />
    )}
    <Text
      numberOfLines={2}
      ellipsizeMode="tail"
      className="text-[10px] text-center text-wrap max-w-16 mt-1"
    >
      {product.name}
    </Text>
  </Pressable>
);

export default function ViewAllItemScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const scrollY = useRef(new Animated.Value(0)).current;

  const {
    data: productsByCategories,
    isLoading,
    error,
  } = useProductsByCategories();

  const categoryData = productsByCategories?.find(
    (category) => category.category.id === categoryId,
  );

  const searchBarOpacity = scrollY.interpolate({
    inputRange: [50, 150],
    outputRange: [1, 0.2],
    extrapolate: "clamp",
  });

  const handleBackPress = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView
          className="flex-1 bg-light-main-container"
          edges={["top"]}
        >
          <View className="flex-row items-center p-4">
            <Pressable onPress={handleBackPress} className="mr-4">
              <ArrowLeft color="#c71c4b" size={24} />
            </Pressable>
            <SingleLoadingSekeleton width={150} height={24} borderRadius={4} />
          </View>
          <View className="pb-4">
            <SingleLoadingSekeleton
              width="90%"
              height={48}
              borderRadius={24}
              style={{ alignSelf: "center" }}
            />
          </View>
          <LoadingSkeletons />
        </SafeAreaView>
      </>
    );
  }

  if (error || !categoryData) {
    return (
      <SafeAreaView className="flex-1 bg-light-main-container items-center justify-center">
        <Text>Failed to load items.</Text>
        <Text className="text-light-error mt-2">
          {error instanceof Error ? error.message : "Category not found"}
        </Text>
      </SafeAreaView>
    );
  }

  const filteredProducts = searchQuery
    ? categoryData.products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : categoryData.products;

  const listData: TListItem[] = [
    { type: "header", title: categoryData.category.name },
    { type: "searchBar", searchQuery, setSearchQuery },
    { type: "items", products: filteredProducts },
  ];

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <View className="flex-row items-center p-4">
          <Pressable onPress={handleBackPress} className="mr-4">
            <ArrowLeft color="#c71c4b" size={24} />
          </Pressable>
          <Text className="text-light-matte-black text-xl font-bold">
            {categoryData.category.name}
          </Text>
        </View>
        <FlashList
          data={listData}
          renderItem={({ item }) => {
            if (item.type === "searchBar") {
              return (
                <View className="pb-4">
                  <SearchBar
                    searchQuery={item.searchQuery}
                    setSearchQuery={item.setSearchQuery}
                    searchBarOpacity={searchBarOpacity}
                    variant="borderedMinimal"
                    placeholder={`Search in ${categoryData.category.name}...`}
                  />
                </View>
              );
            }

            if (item.type === "items") {
              return (
                <View className="px-4">
                  <View className="w-full" style={{ minHeight: 300 }}>
                    <FlashList
                      data={item.products}
                      renderItem={({ item: product }) => (
                        <ProductItem product={product} router={router} />
                      )}
                      keyExtractor={(product) => product.id}
                      estimatedItemSize={20}
                      numColumns={4}
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{
                        paddingVertical: 4,
                        paddingHorizontal: 4,
                      }}
                    />
                  </View>
                </View>
              );
            }

            return null;
          }}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingBottom: 24 }}
          estimatedItemSize={30}
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

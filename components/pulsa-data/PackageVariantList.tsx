import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import React, { memo, useCallback } from "react";
import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TProductVariant } from "@/api/types/product";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";
import { usePhoneNumber } from "@/hooks/pulsa-data";
import { PackageVariantItem } from "./PackageVariantItem";

const SKELETON_COUNT = 4;
const SKELETON_HEIGHT = 72;
const SKELETON_BORDER_RADIUS = 12;

function LoadingSkeleton() {
  return (
    <View className="mt-4">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <View key={i} className="mb-3">
          <SingleLoadingSekeleton
            width="100%"
            height={SKELETON_HEIGHT}
            borderRadius={SKELETON_BORDER_RADIUS}
          />
        </View>
      ))}
    </View>
  );
}

function EmptyStateMessage({ message }: { message: string }) {
  return (
    <View className="items-center py-8">
      <Text className="text-light-matte-black/60 text-center">{message}</Text>
    </View>
  );
}

export const PackageVariantList = memo(function PackageVariantList() {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const bottomOffset =
    Platform.OS === "ios" ? 0 : bottomInset > 0 ? bottomInset : 0;

  const {
    phoneNumber,
    productDetail,
    providerInfo,
    isLoading,
    isValidPhoneNumber,
    detectedProvider,
  } = usePhoneNumber();

  const handleVariantPress = useCallback(
    (variant: TProductVariant) => {
      if (isValidPhoneNumber) {
        router.push({
          pathname: "/payment",
          params: {
            variantId: variant.id,
            customerInfo: JSON.stringify([
              { key: "no_hp", value: phoneNumber },
            ]),
          },
        });
      }
    },
    [phoneNumber, isValidPhoneNumber],
  );

  const renderItem = useCallback(
    ({ item }: { item: TProductVariant }) => (
      <PackageVariantItem
        variant={item}
        disabled={!isValidPhoneNumber}
        onPress={handleVariantPress}
      />
    ),
    [isValidPhoneNumber, handleVariantPress],
  );

  const keyExtractor = useCallback((item: TProductVariant) => item.id, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const variants = productDetail?.variants;

  if (variants && variants.length > 0) {
    return (
      <FlashList
        data={variants}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: bottomOffset,
        }}
        estimatedItemSize={SKELETON_HEIGHT}
      />
    );
  }

  if (detectedProvider && !variants) {
    return (
      <EmptyStateMessage
        message={`No packages available for ${providerInfo?.name}`}
      />
    );
  }

  return (
    <EmptyStateMessage message="Enter your phone number to see available packages" />
  );
});

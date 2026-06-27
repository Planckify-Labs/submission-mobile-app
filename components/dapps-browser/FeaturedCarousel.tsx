import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
} from "react-native";
import type { TDapp, TDappPromotion } from "@/api/types/dapp";
import { usePromotions, useSponsoredDapps } from "@/hooks/queries/useDapps";
import FeaturedBanner from "./FeaturedBanner";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH * 0.88;
const BANNER_SPACING = 12;

type FeaturedCarouselProps = {
  onNavigateToDapp: (url: string) => void;
};

// Until the editorial promotions table is populated, derive banners from
// sponsored dapps so the carousel is never empty.
const promotionFromDapp = (d: TDapp): TDappPromotion => ({
  id: `sponsor-${d.id}`,
  title: d.name,
  subtitle: d.category?.name ?? "Featured",
  description: d.description,
  imageUrl: d.logoUrl,
  appearance: d.appearance,
  targetUrl: d.websiteUrl,
  dappId: d.id,
  isSponsored: true,
  isActive: true,
  sortOrder: d.sortOrder ?? 0,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const FeaturedCarousel = memo<FeaturedCarouselProps>(function FeaturedCarousel({
  onNavigateToDapp,
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: promotions } = usePromotions();
  const { data: sponsored } = useSponsoredDapps();

  const banners = useMemo<TDappPromotion[]>(() => {
    if (promotions && promotions.length > 0) return promotions;
    return (sponsored ?? []).map(promotionFromDapp);
  }, [promotions, sponsored]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      setActiveIndex(Math.round(x / (BANNER_WIDTH + BANNER_SPACING)));
    },
    [],
  );

  if (banners.length === 0) return null;

  return (
    <View className="mb-5">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={BANNER_WIDTH + BANNER_SPACING}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingHorizontal: (SCREEN_WIDTH - BANNER_WIDTH) / 2,
          gap: BANNER_SPACING,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {banners.map((item) => (
          <FeaturedBanner
            key={item.id}
            item={item}
            onPress={onNavigateToDapp}
            width={BANNER_WIDTH}
          />
        ))}
      </ScrollView>

      {banners.length > 1 && (
        <View className="flex-row justify-center mt-3 gap-2">
          {banners.map((item, index) => (
            <View
              key={item.id}
              className={`h-1.5 rounded-full ${
                index === activeIndex
                  ? "bg-light-primary-red w-5"
                  : "bg-light-matte-black/20 w-1.5"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export default FeaturedCarousel;

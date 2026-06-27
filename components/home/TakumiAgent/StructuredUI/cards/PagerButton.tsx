/**
 * Shared Prev/Next pager pill used by agent list cards
 * (RedemptionCatalogCard, OpportunityListCard) so paging affordances stay
 * visually identical across the structured-UI surface.
 */

import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text, TouchableOpacity } from "react-native";

const BRAND_RED = "#c71c4b";

export default function PagerButton({
  direction,
  disabled,
  onPress,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onPress: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isPrev ? "Previous page" : "Next page"}
      className={`flex-row items-center gap-1 rounded-full border-2 px-3 py-1 ${
        disabled
          ? "border-light-matte-black/15 opacity-40"
          : "border-light-primary-red bg-light-primary-red/10"
      }`}
    >
      {isPrev ? <ChevronLeft size={16} color={BRAND_RED} /> : null}
      <Text className="text-light-matte-black text-xs font-bold">
        {isPrev ? "Prev" : "Next"}
      </Text>
      {isPrev ? null : <ChevronRight size={16} color={BRAND_RED} />}
    </TouchableOpacity>
  );
}

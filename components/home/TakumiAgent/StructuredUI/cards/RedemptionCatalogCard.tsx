import { router } from "expo-router";
import { AlertTriangle, MoveRight, ShoppingBag } from "lucide-react-native";
import type React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import OptimizedImage from "@/components/common/OptimizedImage";
import SingleLoadingSekeleton from "@/components/common/SingleLoadingSekeleton";
import type { ToolComponentProps } from "../types";

type CatalogProduct = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  code?: string;
  category_id?: string;
  category?: { id: string; name: string } | null;
  starting_points?: string | null;
  input_type?: string | null;
};

/** Format a raw points string ("2300") as "2,300 pts"; null-safe. */
function formatPoints(raw?: string | null): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString("en-US")} pts`;
}

type CatalogGroup = {
  category: { id: string; name: string };
  products: CatalogProduct[];
};

type CatalogInput = {
  query?: string;
  name?: string;
  category?: string;
  category_id?: string;
  min_points?: number;
  max_points?: number;
  take?: number;
};

type CatalogPayload = {
  products?: CatalogProduct[];
  groups?: CatalogGroup[];
};

type CatalogOutput = {
  status?: "success" | "failed" | string;
  error?: string;
  display?: CatalogPayload;
  data?: CatalogPayload;
};

const BRAND_RED = "#c71c4b";

function ProductTile({ product }: { product: CatalogProduct }) {
  const onPress = () => {
    router.push({
      pathname: "/purchase-item",
      params: { productId: product.id },
    });
  };
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${product.name}`}
      className="w-1/4 items-center justify-center p-1"
    >
      {product.image_url ? (
        <View className="rounded-2xl overflow-hidden w-16 h-16 border-2 border-light-matte-black bg-light-primary-red/40">
          <OptimizedImage
            source={{ uri: product.image_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            alt={`${product.name} image`}
          />
        </View>
      ) : (
        <View className="rounded-2xl border-2 border-light-matte-black w-16 h-16 bg-light-primary-red/40" />
      )}
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        className="text-[10px] text-center text-wrap text-light-matte-black max-w-16 mt-1"
      >
        {product.name}
      </Text>
      {formatPoints(product.starting_points) ? (
        <Text
          numberOfLines={1}
          className="text-[9px] text-center text-light-primary-red font-bold max-w-16"
        >
          {formatPoints(product.starting_points)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function SkeletonTile() {
  return (
    <View className="w-1/4 items-center justify-center p-1">
      <SingleLoadingSekeleton width={64} height={64} borderRadius={16} />
      <SingleLoadingSekeleton
        width={48}
        height={10}
        borderRadius={4}
        style={{ marginTop: 4 }}
      />
    </View>
  );
}

function ProductGrid({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return (
      <Text className="text-[11px] text-gray-500 py-2">No items matched.</Text>
    );
  }
  return (
    <View className="flex-row flex-wrap">
      {products.map((p) => (
        <ProductTile key={p.id} product={p} />
      ))}
    </View>
  );
}

function SkeletonGrid({ count = 8 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <View className="flex-row flex-wrap">
      {items.map((i) => (
        <SkeletonTile key={i} />
      ))}
    </View>
  );
}

function SkeletonCategoryCard({ tileCount = 8 }: { tileCount?: number }) {
  return (
    <View className="rounded-[14px] w-full gap-4 mb-4">
      <View className="flex-row items-center">
        <SingleLoadingSekeleton width={120} height={14} borderRadius={4} />
        <View className="ml-auto">
          <SingleLoadingSekeleton width={96} height={30} borderRadius={999} />
        </View>
      </View>
      <SkeletonGrid count={tileCount} />
    </View>
  );
}

function CategoryCard({
  title,
  products,
  categoryId,
  showViewAll,
}: {
  title: string;
  products: CatalogProduct[];
  categoryId?: string;
  showViewAll: boolean;
}) {
  const handleViewAll = () => {
    if (!categoryId) return;
    if (
      title.toLowerCase().includes("pulsa") &&
      title.toLowerCase().includes("data")
    ) {
      router.push("/pulsa-data");
    } else {
      router.push({
        pathname: "/view-all-item",
        params: { categoryId, categoryName: title },
      });
    }
  };

  return (
    <View className="rounded-[14px] w-full gap-4 mb-4">
      <View className="flex-row">
        <Text className="text-light-matte-black text-sm">{title}</Text>
        {showViewAll && categoryId ? (
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center justify-center border-2 ml-auto border-light-primary-red bg-light-primary-red/10 gap-2 rounded-full px-4 py-1"
            onPress={handleViewAll}
          >
            <Text className="text-light-matte-black text-sm font-bold">
              View All
            </Text>
            <MoveRight size={20} color={BRAND_RED} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ProductGrid products={products} />
    </View>
  );
}

/**
 * Group a flat search result list by its inline category so multi-category
 * matches (e.g. a query that hits both "Gaming" and "Vouchers") render as
 * separate, View-All-able sections instead of one undifferentiated grid.
 * Products with no category fall into a trailing "Other" bucket. Insertion
 * order is preserved so the most-relevant category (first match) stays on
 * top.
 */
function groupFlatByCategory(products: CatalogProduct[]): {
  groups: CatalogGroup[];
  uncategorized: CatalogProduct[];
} {
  const groups = new Map<string, CatalogGroup>();
  const uncategorized: CatalogProduct[] = [];
  for (const p of products) {
    if (p.category?.id) {
      const existing = groups.get(p.category.id);
      if (existing) {
        existing.products.push(p);
      } else {
        groups.set(p.category.id, { category: p.category, products: [p] });
      }
    } else {
      uncategorized.push(p);
    }
  }
  return { groups: [...groups.values()], uncategorized };
}

const RedemptionCatalogCard: React.FC<
  ToolComponentProps<CatalogInput, CatalogOutput>
> = ({ state, input, output }) => {
  // Surface whatever the user actually searched for. `query` is the broad
  // keyword lever, `category` scopes to a product type, `name` is an exact
  // product match — show the most specific one we have.
  const searchTerm = input.query || input.name || input.category;
  // A points-budget query ("under 2,300 pts") wants a flat cheapest-first
  // list — the API already orders results that way, so we must NOT regroup
  // them by category (that would shatter the price ordering).
  const isPointsQuery = input.min_points != null || input.max_points != null;
  const pointsLabel = (() => {
    const min = formatPoints(input.min_points?.toString());
    const max = formatPoints(input.max_points?.toString());
    if (min && max) return `${min} – ${max}`;
    if (max) return `Up to ${max}`;
    if (min) return `From ${min}`;
    return null;
  })();
  const searchLabel = searchTerm
    ? `Matches for "${searchTerm}"`
    : (pointsLabel ?? "Redemption catalog");

  if (state === "input-streaming" || state === "input-available" || !output) {
    return (
      <View className="my-1.5-">
        <View className="flex-row items-center gap-2 mb-2">
          <ShoppingBag size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
            {searchLabel}
          </Text>
          <View className="ml-auto">
            <SingleLoadingSekeleton width={40} height={10} borderRadius={4} />
          </View>
        </View>
        <SkeletonCategoryCard tileCount={8} />
        <SkeletonCategoryCard tileCount={4} />
      </View>
    );
  }

  if (state === "output-error" || output.status === "failed") {
    // CLAUDE.md user-facing-error rule — never surface `output.error`
    // (a machine code like `unknown_error`) verbatim. Log raw to dev,
    // show hand-written copy to the user.
    if (__DEV__ && output.error) {
      console.warn(
        "[RedemptionCatalogCard] catalog load failed:",
        output.error,
      );
    }
    return (
      <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <AlertTriangle size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
            Couldn&apos;t load catalog
          </Text>
        </View>
        <Text className="text-sm text-light-matte-black/80 mt-1.5">
          We couldn&apos;t load the catalog right now. Please try again in a
          moment.
        </Text>
      </View>
    );
  }

  const payload = output.display ?? output.data ?? {};
  const groups = Array.isArray(payload.groups) ? payload.groups : null;
  const flat = Array.isArray(payload.products) ? payload.products : null;
  const totalCount =
    (groups?.reduce((sum, g) => sum + (g.products?.length ?? 0), 0) ?? 0) +
    (flat?.length ?? 0);

  if (totalCount === 0) {
    return (
      <View className="my-1.5 rounded-2xl border border-light-matte-black/10 bg-white px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <ShoppingBag size={14} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
            {searchLabel}
          </Text>
        </View>
        <Text className="text-sm text-gray-500 mt-2">
          No matching products right now.
        </Text>
      </View>
    );
  }

  return (
    <View className="my-1.5">
      <View className="flex-row items-center gap-2 mb-2 px-1">
        <ShoppingBag size={14} color={BRAND_RED} />
        <Text className="text-xs font-bold uppercase tracking-wide text-light-matte-black">
          {searchLabel}
        </Text>
        <Text className="text-[11px] text-gray-500 ml-auto">
          {totalCount} {totalCount === 1 ? "item" : "items"}
        </Text>
      </View>

      {groups?.map((g) => (
        <CategoryCard
          key={g.category.id}
          title={g.category.name}
          products={g.products ?? []}
          categoryId={g.category.id}
          showViewAll
        />
      ))}

      {flat && flat.length > 0 ? (
        isPointsQuery ? (
          // Cheapest-first: keep the API's price ordering as one flat
          // grid; grouping by category would break it.
          <CategoryCard
            title={
              pointsLabel ? `${pointsLabel} · cheapest first` : "Cheapest first"
            }
            products={flat}
            showViewAll={false}
          />
        ) : (
          (() => {
            const { groups: flatGroups, uncategorized } =
              groupFlatByCategory(flat);
            return (
              <>
                {flatGroups.map((g) => (
                  <CategoryCard
                    key={g.category.id}
                    title={g.category.name}
                    products={g.products}
                    categoryId={g.category.id}
                    showViewAll
                  />
                ))}
                {uncategorized.length > 0 ? (
                  <CategoryCard
                    title={searchTerm ? `Results for "${searchTerm}"` : "Items"}
                    products={uncategorized}
                    showViewAll={false}
                  />
                ) : null}
              </>
            );
          })()
        )
      ) : null}
    </View>
  );
};

export default RedemptionCatalogCard;

import React from "react";
import { Pressable, Text, View } from "react-native";
import type { TAssetTabContentProps } from "@/constants/types/assetTypes";
import AssetLoadingSkeletons from "./AssetLoadingSkeletons";

const AssetTabContent = ({
  state,
  data,
  actions,
  renderItems,
}: TAssetTabContentProps) => {
  const { activeTab, searchQuery, isLoading } = state;
  const { userAssets, filteredUserAssets, filteredAvailableAssets } = data;
  const { setActiveTab } = actions;
  const { renderUserAssetItem, renderAvailableAssetItem } = renderItems;

  if (activeTab === "my-assets") {
    return (
      <View>
        {userAssets.length > 0 ? (
          filteredUserAssets.length > 0 ? (
            <View>
              {filteredUserAssets.map((item) => (
                <React.Fragment key={item.id}>
                  {renderUserAssetItem({ item })}
                </React.Fragment>
              ))}
            </View>
          ) : searchQuery ? (
            <View className="items-center justify-center py-5">
              <Text className="text-light-matte-black/60 text-center">
                No assets found matching your search
              </Text>
            </View>
          ) : null
        ) : (
          <View className="items-center justify-center py-5">
            <Text className="text-light-matte-black/60 text-center mb-4">
              You haven't added any assets yet
            </Text>
            <Pressable
              onPress={() => setActiveTab("explore-assets")}
              className="bg-light-primary-red px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-bold">
                Browse Available Assets
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  } else {
    return (
      <View>
        {isLoading ? (
          <AssetLoadingSkeletons count={5} />
        ) : filteredAvailableAssets.length > 0 ? (
          <View>
            {filteredAvailableAssets.map((item) => (
              <React.Fragment key={item.id}>
                {renderAvailableAssetItem({ item })}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View className="items-center justify-center py-10">
            <Text className="text-light-matte-black/60 text-center">
              {searchQuery
                ? "No assets found matching your search"
                : "No assets available"}
            </Text>
          </View>
        )}
      </View>
    );
  }
};

export default AssetTabContent;

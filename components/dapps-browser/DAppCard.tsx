import { Image } from "expo-image";
import { Star } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import type { TDApp } from "@/constants/dummyData/ecosystemList";

type DAppCardProps = {
  dapp: TDApp;
  onPress: (url: string) => void;
  variant?: "default" | "compact" | "grid";
  isFavorite?: boolean;
  onToggleFavorite?: (dapp: TDApp) => void;
  showFavoriteButton?: boolean;
};

const DAppCard = memo<DAppCardProps>(function DAppCard({
  dapp,
  onPress,
  variant = "default",
  isFavorite = false,
  onToggleFavorite,
  showFavoriteButton = true,
}) {
  const handlePress = () => {
    onPress(dapp.url);
  };

  const handleToggleFavorite = (e: any) => {
    e.stopPropagation();
    onToggleFavorite?.(dapp);
  };

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        className="bg-white rounded-2xl p-4 active:opacity-70"
        style={{
          width: 150,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View className="items-center">
          {showFavoriteButton && onToggleFavorite && (
            <TouchableOpacity
              onPress={handleToggleFavorite}
              className="absolute top-0 right-0 z-10 p-1.5 bg-white rounded-full"
              activeOpacity={0.7}
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              }}
            >
              <Star
                size={14}
                color="#c71c4b"
                fill={isFavorite ? "#c71c4b" : "transparent"}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          )}
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mb-3 overflow-hidden"
            style={{ backgroundColor: "#c71c4b08" }}
          >
            <Image
              source={{ uri: dapp.logoUrl }}
              style={{ width: 40, height: 40 }}
              contentFit="contain"
              transition={200}
            />
          </View>
          <Text
            className="text-light-matte-black font-bold text-sm text-center mb-1"
            numberOfLines={1}
          >
            {dapp.name}
          </Text>
          <Text
            className="text-light-matte-black/50 text-[11px] text-center leading-4"
            numberOfLines={2}
          >
            {dapp.description}
          </Text>
        </View>
      </Pressable>
    );
  }

  if (variant === "grid") {
    return (
      <Pressable
        onPress={handlePress}
        className="bg-white rounded-2xl p-3 active:opacity-70 mx-1.5 mb-3"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View className="flex-row items-center">
          <View
            className="w-11 h-11 rounded-xl items-center justify-center mr-2.5 overflow-hidden"
            style={{ backgroundColor: "#c71c4b08" }}
          >
            <Image
              source={{ uri: dapp.logoUrl }}
              style={{ width: 32, height: 32 }}
              contentFit="contain"
              transition={200}
            />
          </View>
          <View className="flex-1">
            <Text
              className="text-light-matte-black font-bold text-xs mb-0.5"
              numberOfLines={1}
            >
              {dapp.name}
            </Text>
            <Text
              className="text-light-matte-black/50 text-[10px]"
              numberOfLines={1}
            >
              {dapp.description}
            </Text>
          </View>
          {showFavoriteButton && onToggleFavorite && (
            <TouchableOpacity
              onPress={handleToggleFavorite}
              className="p-1"
              activeOpacity={0.7}
            >
              <Star
                size={14}
                color="#c71c4b"
                fill={isFavorite ? "#c71c4b" : "transparent"}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      className="bg-white rounded-2xl p-4 flex-row items-center active:opacity-70"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center mr-4 overflow-hidden"
        style={{ backgroundColor: "#c71c4b08" }}
      >
        <Image
          source={{ uri: dapp.logoUrl }}
          style={{ width: 40, height: 40 }}
          contentFit="contain"
          transition={200}
        />
      </View>
      <View className="flex-1">
        <Text className="text-light-matte-black font-bold text-base mb-1">
          {dapp.name}
        </Text>
        <Text className="text-light-matte-black/50 text-sm" numberOfLines={2}>
          {dapp.description}
        </Text>
      </View>
      {showFavoriteButton && onToggleFavorite && (
        <TouchableOpacity
          onPress={handleToggleFavorite}
          className="ml-3 p-2 bg-light-main-container rounded-xl"
          activeOpacity={0.7}
        >
          <Star
            size={18}
            color="#c71c4b"
            fill={isFavorite ? "#c71c4b" : "transparent"}
            strokeWidth={2.5}
          />
        </TouchableOpacity>
      )}
    </Pressable>
  );
});

export default DAppCard;

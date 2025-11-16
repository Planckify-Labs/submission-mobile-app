import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const FAVORITE_DAPPS_KEY = "takumipay_favorite_dapps";

export type FavoriteDApp = {
  id: string;
  name: string;
  description: string;
  url: string;
  logoUrl: string;
  timestamp: number; // When it was favorited
};

export const useFavoriteDApps = () => {
  const [favoriteDApps, setFavoriteDApps] = useState<FavoriteDApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from storage on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITE_DAPPS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FavoriteDApp[];
        // Sort by timestamp (most recent first)
        const sorted = parsed.sort((a, b) => b.timestamp - a.timestamp);
        setFavoriteDApps(sorted);
      }
    } catch (error) {
      console.error("Failed to load favorite dApps:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFavorites = useCallback(async (favorites: FavoriteDApp[]) => {
    try {
      await AsyncStorage.setItem(FAVORITE_DAPPS_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error("Failed to save favorite dApps:", error);
    }
  }, []);

  const isFavorite = useCallback(
    (dappId: string): boolean => {
      return favoriteDApps.some((fav) => fav.id === dappId);
    },
    [favoriteDApps],
  );

  const toggleFavorite = useCallback(
    async (dapp: {
      id: string;
      name: string;
      description: string;
      url: string;
      logoUrl: string;
    }) => {
      const isCurrentlyFavorite = isFavorite(dapp.id);

      let updatedFavorites: FavoriteDApp[];

      if (isCurrentlyFavorite) {
        // Remove from favorites
        updatedFavorites = favoriteDApps.filter((fav) => fav.id !== dapp.id);
      } else {
        // Add to favorites
        const newFavorite: FavoriteDApp = {
          ...dapp,
          timestamp: Date.now(),
        };
        updatedFavorites = [newFavorite, ...favoriteDApps];
      }

      setFavoriteDApps(updatedFavorites);
      await saveFavorites(updatedFavorites);

      return !isCurrentlyFavorite; // Return new favorite status
    },
    [favoriteDApps, isFavorite, saveFavorites],
  );

  const clearAllFavorites = useCallback(async () => {
    setFavoriteDApps([]);
    await saveFavorites([]);
  }, [saveFavorites]);

  return {
    favoriteDApps,
    isLoading,
    isFavorite,
    toggleFavorite,
    clearAllFavorites,
  };
};


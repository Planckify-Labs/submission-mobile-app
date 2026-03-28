import { QueryClient, useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { router, SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PerformanceProvider } from "@/components/providers/PerformanceProvider";
import {
  mmkvPersister,
  shouldPersistQuery,
} from "@/lib/storage/queryPersister";
import "../global.css";
import "../pollyfills";

SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  "VirtualizedLists should never be nested",
  "Sending `onAnimatedValueUpdate` with no listeners registered",
]);

const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // gcTime must be >= PERSIST_MAX_AGE so data isn't GC'd before persistence reads it
      gcTime: PERSIST_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      // Re-enable reconnect refetch so stale data refreshes when coming back online
      refetchOnReconnect: true,
    },
  },
});

function InitializeApp() {
  const isRestoring = useIsRestoring();
  const { wallets, isLoading, loadWallets } =
    require("@/hooks/useWallet").useWallet();

  useEffect(() => {
    // Wait for PersistQueryClientProvider to finish restoring the cache.
    // During restoration isLoading is false but data is empty — acting on
    // that would incorrectly redirect to /login.
    if (isRestoring) return;

    async function prepare() {
      try {
        await loadWallets();

        if (!isLoading && wallets.length === 0) {
          router.replace("/login");
        }
      } catch (e) {
        console.warn("Error loading wallet data:", e);
      } finally {
        setTimeout(() => {
          SplashScreen.hideAsync();
        }, 100);
      }
    }

    prepare();
  }, [isRestoring, isLoading, wallets.length, loadWallets]);

  return null;
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: mmkvPersister,
        maxAge: PERSIST_MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      <PerformanceProvider>
        <SafeAreaProvider>
          <InitializeApp />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "ios_from_left",
              contentStyle: { backgroundColor: "#f5f6f9" },
              animationDuration: 700,
            }}
          />
        </SafeAreaProvider>
      </PerformanceProvider>
    </PersistQueryClientProvider>
  );
}

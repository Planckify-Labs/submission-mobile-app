import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PerformanceProvider } from "@/components/providers/PerformanceProvider";
import "../global.css";
import "../pollyfills";

SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  "VirtualizedLists should never be nested",
  "Sending `onAnimatedValueUpdate` with no listeners registered",
]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

function InitializeApp() {
  const { wallets, isLoading, loadWallets } =
    require("@/hooks/useWallet").useWallet();

  useEffect(() => {
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
  }, [isLoading, wallets.length, loadWallets]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

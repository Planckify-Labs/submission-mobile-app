import { createMMKV } from "react-native-mmkv";

// General purpose storage — replaces AsyncStorage for non-sensitive app data
export const storage = createMMKV({ id: "takumipay-app" });

// Dedicated instance for TanStack Query cache persistence
export const queryCache = createMMKV({ id: "takumipay-query-cache" });

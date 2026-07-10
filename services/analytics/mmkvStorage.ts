import type { PostHogCustomStorage } from "posthog-react-native";
import { storage } from "@/lib/storage/mmkv";

// PostHog persists its event queue, distinct id, and session state through
// this adapter instead of pulling in @react-native-async-storage/async-storage
// — the app's storage convention is MMKV everywhere else (lib/storage/mmkv.ts).
export const posthogMmkvStorage: PostHogCustomStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, value);
  },
};

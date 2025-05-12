import { Stack } from "expo-router";
import "../pollyfills";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

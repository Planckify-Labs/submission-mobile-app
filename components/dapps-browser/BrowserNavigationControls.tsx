import { BlurView } from "expo-blur";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  RotateCcw,
  Search,
} from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface BrowserState {
  canGoBack: boolean;
  canGoForward: boolean;
}

interface BrowserNavigationControlsProps {
  browserState: BrowserState;
  onGoBack: () => void;
  onGoForward: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  onHome: () => void;
}

export default function BrowserNavigationControls({
  browserState,
  onGoBack,
  onGoForward,
  onSearch,
  onRefresh,
  onHome,
}: BrowserNavigationControlsProps) {
  return (
    <View className="justify-center">
      <BlurView
        intensity={20}
        experimentalBlurMethod="dimezisBlurView"
        className="px-2"
      >
        <View className="p-2">
          <View className="flex-row items-center justify-between gap-2">
            <TouchableOpacity
              onPress={onGoBack}
              disabled={!browserState.canGoBack}
              className={`p-3 rounded-full ${
                browserState.canGoBack ? "bg-white/20" : "bg-gray-500/10"
              }`}
            >
              <ArrowLeft
                size={20}
                color={browserState.canGoBack ? "#374151" : "#9CA3AF"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onGoForward}
              disabled={!browserState.canGoForward}
              className={`p-3 rounded-full ${
                browserState.canGoForward ? "bg-white/20" : "bg-gray-500/10"
              }`}
            >
              <ArrowRight
                size={20}
                color={browserState.canGoForward ? "#374151" : "#9CA3AF"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSearch}
              className="p-3 rounded-full bg-white/20"
            >
              <Search size={20} color="#374151" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onRefresh}
              className="p-3 rounded-full bg-white/20"
            >
              <RotateCcw size={20} color="#374151" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onHome}
              className="p-3 rounded-full bg-white/20"
            >
              <Home size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

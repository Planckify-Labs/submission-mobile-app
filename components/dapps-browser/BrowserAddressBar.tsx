import { BlurView } from "expo-blur";
import { Shield } from "lucide-react-native";
import React from "react";
import { TextInput, TouchableOpacity, View } from "react-native";

interface BrowserAddressBarProps {
  addressBarText: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  onGoBack: () => void;
  addressBarRef: React.RefObject<TextInput | null>;
}

export default function BrowserAddressBar({
  addressBarText,
  onChangeText,
  onSubmitEditing,
  onGoBack,
  addressBarRef,
}: BrowserAddressBarProps) {
  return (
    <View className="flex-row gap-2 px-2">
      <BlurView
        intensity={40}
        experimentalBlurMethod="dimezisBlurView"
        className="rounded-full overflow-hidden grow"
      >
        <View className="p-2- border-4 border-light-primary-red/35 rounded-full">
          <TextInput
            ref={addressBarRef}
            value={addressBarText}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            placeholder="Search or enter website URL"
            className="bg-transparent text-light-matte-black text-base p-2 px-4"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </BlurView>
      <BlurView
        intensity={40}
        experimentalBlurMethod="dimezisBlurView"
        className="rounded-full overflow-hidden aspect-square justify-center items-center"
      >
        <TouchableOpacity onPress={onGoBack} className="w-fit bg-light/5">
          <Shield size={20} color="#000" />
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

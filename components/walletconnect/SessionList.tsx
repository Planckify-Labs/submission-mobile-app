import React from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import type { WCSession } from "@/services/walletconnect/sessionStore";

interface SessionListProps {
  sessions: WCSession[];
  onDisconnect: (topic: string) => void;
}

export function SessionList({ sessions, onDisconnect }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Text className="text-gray-500 dark:text-gray-400 text-base">
          No active sessions
        </Text>
        <Text className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Scan a WalletConnect QR code to connect
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.topic}
      renderItem={({ item }) => (
        <View className="flex-row items-center px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          {/* dApp icon */}
          <View className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center mr-3">
            {item.peerIcon ? (
              <Image source={{ uri: item.peerIcon }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
              <Text className="text-gray-500 text-sm font-bold">
                {item.peerName.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>

          {/* Session info */}
          <View className="flex-1">
            <Text className="text-base font-medium text-gray-900 dark:text-white">{item.peerName}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">{item.peerUrl}</Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {item.chains.join(", ")}
            </Text>
          </View>

          {/* Disconnect */}
          <Pressable onPress={() => onDisconnect(item.topic)} className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30">
            <Text className="text-red-600 dark:text-red-400 text-xs font-medium">Disconnect</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

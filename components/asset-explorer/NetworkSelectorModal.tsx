import { TNetworkSelectorModalProps } from "@/constants/types/networkTypes";
import { useBlockchains } from "@/hooks/queries/useBlockchains";
import { Pin } from "lucide-react-native";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const { height } = Dimensions.get("window");
const MODAL_HEIGHT = height * 0.67;

const NetworkSelectorModal = ({
  visible,
  activeNetworkId,
  searchQuery,
  onSearchChange,
  onSelectNetwork,
  toggleNetworkPin,
  closeModal,
  fadeAnim,
  translateY,
}: TNetworkSelectorModalProps) => {
  const { data: blockchains, isLoading } = useBlockchains({ isActive: true });

  // Map blockchain data to network format
  const apiNetworks = React.useMemo(() => {
    if (!blockchains) return [];

    return blockchains.map((blockchain) => {
      return {
        id: blockchain.chainId.toString(),
        name: blockchain.name,
        symbol: blockchain.tokens?.[0]?.symbol,
        color: "#627EEA",
        isPinned: true,
        blockchainId: blockchain.id,
        logoUrl: blockchain.tokens?.[0]?.logoUrl || "",
      };
    });
  }, [blockchains]);

  const displayNetworks = apiNetworks;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, translateY]);

  const handleSearchChange = (text: string) => {
    onSearchChange(text);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeModal}
    >
      <TouchableWithoutFeedback onPress={closeModal}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            opacity: fadeAnim,
          }}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: MODAL_HEIGHT,
                backgroundColor: "#fff",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                transform: [{ translateY: translateY }],
              }}
            >
              <View className="p-4">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-xl font-bold text-light-matte-black">
                    Select Network
                  </Text>
                  <Pressable
                    onPress={closeModal}
                    className="w-8 h-8 rounded-full bg-light-matte-black/5 items-center justify-center"
                  >
                    <Text className="text-light-matte-black text-lg">×</Text>
                  </Pressable>
                </View>

                <TextInput
                  className="bg-light-matte-black/5 p-3 rounded-xl mb-4"
                  placeholder="Search networks..."
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                />

                <ScrollView
                  className="max-h-[500px]"
                  showsVerticalScrollIndicator={false}
                >
                  {isLoading ? (
                    <View className="items-center justify-center py-8">
                      <ActivityIndicator color="#c71c4b" />
                      <Text className="text-light-matte-black mt-2">
                        Loading networks...
                      </Text>
                    </View>
                  ) : (
                    displayNetworks.map((item) => (
                      <View
                        key={item.id}
                        className="flex-row items-center justify-between p-3"
                      >
                        <Pressable
                          className="flex-row items-center flex-1"
                          onPress={() =>
                            onSelectNetwork &&
                            onSelectNetwork(item.id, item.blockchainId)
                          }
                        >
                          {item.logoUrl ? (
                            <Image
                              source={{ uri: item.logoUrl }}
                              className="w-8 h-8 rounded-full mr-3"
                              style={{ backgroundColor: "#f5f5f5" }}
                              resizeMode="contain"
                            />
                          ) : (
                            <View
                              className="w-8 h-8 rounded-full mr-3 items-center justify-center"
                              style={{
                                backgroundColor: item.color || "#627EEA",
                              }}
                            >
                              <Text className="text-white font-bold">
                                {item.symbol?.charAt(0)}
                              </Text>
                            </View>
                          )}
                          <View>
                            <Text className="text-light-matte-black font-medium">
                              {item.name}
                            </Text>
                            <Text className="text-light-matte-black/60 text-xs">
                              {item.symbol}
                            </Text>
                          </View>
                        </Pressable>

                        <View className="flex-row items-center">
                          {activeNetworkId === item.id && (
                            <View className="bg-green-500/10 px-3 py-1 rounded-full mr-3">
                              <Text className="text-green-500 text-xs font-medium">
                                Active
                              </Text>
                            </View>
                          )}

                          <Pressable
                            className="p-2"
                            onPress={() => toggleNetworkPin(item.id)}
                          >
                            <Pin
                              size={18}
                              color={item.isPinned ? "#c71c4b" : "#20222c50"}
                              fill={item.isPinned ? "#c71c4b" : "none"}
                            />
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default NetworkSelectorModal;

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { TToken } from "@/api/types/token";
import QKEY_PinnedTokens from "@/constants/queryKeys/pinnedTokensQueryKeys";
import useRQGlobalState from "./useRQGlobalState";

const storePinnedTokens = async (tokens: TToken[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      QKEY_PinnedTokens.persistent,
      JSON.stringify(tokens),
    );
  } catch (error) {
    console.error("Error storing pinned token data:", error);
    throw new Error("Failed to storing pinned token data");
  }
};

const getPersistentPinnedTokens = async (): Promise<TToken[]> => {
  try {
    const storedPinnedTokens = await AsyncStorage.getItem(
      QKEY_PinnedTokens.persistent,
    );
    return JSON.parse(storedPinnedTokens || "[]");
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return [];
  }
};

const defaultPinnedTokens: TToken[] = [
  {
    id: "01JX6X26CW02H42DHF7X0XRFRN",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 0,
    blockchainId: "",
    contractAddress: "",
    logoUrl: "",
    isStablecoin: false,
    isActive: false,
    createdAt: "",
    updatedAt: "",
    isNativeCurrency: false,
  },
  {
    id: "01JX6X26CYKFH2AWWKYKVNGSB7",
    symbol: "ETH",
    name: "Ethereum",
    decimals: 0,
    blockchainId: "",
    contractAddress: "",
    logoUrl: "",
    isStablecoin: false,
    isActive: false,
    createdAt: "",
    updatedAt: "",
    isNativeCurrency: false,
  },
];

export function usePinnedTokens() {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { data: pinnedTokens = [], setNewData } = useRQGlobalState<TToken[]>({
    queryKey: [QKEY_PinnedTokens.pinned],
    initialData: defaultPinnedTokens,
  });

  const initWithExistingPinnedTokens = async (): Promise<
    TToken[] | undefined
  > => {
    setIsLoading(true);
    try {
      const storedPinnedTokens = await getPersistentPinnedTokens();
      storedPinnedTokens[0] !== undefined
        ? setNewData(storedPinnedTokens)
        : setNewData(defaultPinnedTokens);
      setIsLoading(false);
    } catch (error) {
      console.error("Error checking for existing pinned tokens:", error);
      return undefined;
    }
  };

  useEffect(() => {
    initWithExistingPinnedTokens();
  }, []);
  const setPinnedTokens = async (tokens: TToken[]) => {
    await storePinnedTokens(tokens);
    setNewData(tokens);
  };

  return {
    isLoading,
    setPinnedTokens,
    pinnedTokens,
  };
}

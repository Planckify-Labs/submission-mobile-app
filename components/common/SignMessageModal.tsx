import { Check, Clock, ShieldAlert } from "lucide-react-native";
import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import { useNonce } from "@/hooks/queries/useAuth";
import useRQGlobalState from "@/hooks/useRQGlobalState";
import { useWallet } from "@/hooks/useWallet";
import { getNonceParams } from "@/services/walletKit/chainInfo";

interface TSignMessageModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (rememberChoice: boolean) => void;
  message?: string;
  isDappRequest?: boolean;
  dappDomain?: string;
}

interface TNonceData {
  message: string;
}

const SignMessageModal: FC<TSignMessageModalProps> = ({
  visible,
  onClose,
  onConfirm,
  message: propMessage,
  isDappRequest = false,
  dappDomain,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);

  // Read onClose through a ref so the expiry timer below isn't reset by a
  // new inline callback identity on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { activeWallet, activeChain } = useWallet();

  // Namespace-aware nonce fetch — EVM passes chainId, non-EVM (Solana)
  // passes chainSlug. `getNonceParams` owns the per-family mapping and the
  // race-safe mainnet fallback (active chain can momentarily lag a wallet
  // switch), so this stays chain-agnostic instead of 400'ing on the wrong
  // ("Invalid Ethereum wallet address format") path.
  const nonceOpts = getNonceParams(activeWallet, activeChain);
  const nonceSelector = nonceOpts.chainSlug ?? nonceOpts.chainId;

  const { data: fetchedNonceData, refetch: refetchNonce } = useNonce(
    activeWallet?.address,
    nonceOpts,
  );

  const { data: nonceData, setNewData: setNonceData } =
    useRQGlobalState<TNonceData>({
      queryKey: ["auth", "nonce", activeWallet?.address, nonceSelector],
      initialData: { message: propMessage || "" },
    });

  useEffect(() => {
    if (
      fetchedNonceData?.message &&
      fetchedNonceData.message !== nonceData?.message
    ) {
      setNonceData({ message: fetchedNonceData.message });
    }
  }, [fetchedNonceData, nonceData?.message, setNonceData]);

  useEffect(() => {
    if (activeWallet?.address && visible) {
      refetchNonce();
    }
  }, [activeWallet?.address, refetchNonce, visible]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Reset + run the 5-minute expiry countdown each time the sheet opens.
  // On expiry the request auto-closes.
  useEffect(() => {
    if (!visible) return;
    setTimeLeft(300);
    setRememberChoice(false);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onCloseRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const displayMessage =
    propMessage || nonceData?.message || "Loading authentication message...";

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      height="auto"
      borderRadius={28}
      contentClassName="px-6"
      showCloseButton={!isDappRequest}
    >
      <ModalHeader
        title="Signing Statement"
        right={
          !isDappRequest ? (
            <View
              className={`flex-row items-center px-3 py-1 rounded-full ${timeLeft < 60 ? "bg-light-primary-red/10" : "bg-light-main-container"}`}
            >
              <Clock size={16} color={timeLeft < 60 ? "#c71c4b" : "#20222c"} />
              <Text
                className={`ml-1 ${timeLeft < 60 ? "text-light-primary-red" : "text-light-matte-black"}`}
              >
                {formatTime(timeLeft)}
              </Text>
            </View>
          ) : undefined
        }
      />

      <View className="bg-white rounded-3xl p-6 shadow-sm mb-5">
        <Text className="text-light-matte-black/70 mb-6 text-center">
          You are about to sign the following message with your wallet:
        </Text>

        <View className="bg-light-main-container p-4 rounded-xl mb-6">
          <ScrollView showsVerticalScrollIndicator={false} className="max-h-96">
            <Text className="text-light-matte-black font-medium">
              {displayMessage}
            </Text>
          </ScrollView>
        </View>
        {!isDappRequest && (
          <>
            <Text className="text-light-matte-black/70 mb-6">
              Signing this message proves ownership of your wallet address. This
              is a secure operation that does not cost any gas fees.
            </Text>
            {timeLeft < 60 && (
              <View className="bg-light-primary-red/10 p-3 rounded-lg mb-6">
                <Text className="text-light-primary-red text-center">
                  This authentication request will expire soon. Please complete
                  the process quickly.
                </Text>
              </View>
            )}
          </>
        )}
        <TouchableOpacity
          className="flex-row items-center mb-4 hidden"
          onPress={() => setRememberChoice(!rememberChoice)}
        >
          <View
            className={`w-6 h-6 rounded-md mr-3 items-center justify-center ${rememberChoice ? "bg-light-primary-red" : "border border-light-matte-black/30"}`}
          >
            {rememberChoice && <Check size={16} color="#fff" />}
          </View>
          <Text className="text-light-matte-black flex-1">
            Remember my choice (sign automatically in the future)
          </Text>
        </TouchableOpacity>
      </View>

      {isDappRequest && (
        <View className="mb-4">
          <View className="flex-row items-start gap-4">
            <View className="mt-0.5 w-11 h-11 bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200/30 justify-center items-center rounded-xl shadow-sm">
              <ShieldAlert size={20} color="#d97706" strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-amber-800/90 text-sm font-medium">
                Only sign messages from trusted domains. Malicious signatures
                can compromise your wallet security and funds.
              </Text>
              {dappDomain && (
                <View className="mt-3 bg-white/60 border hidden- border-amber-200/40 rounded-lg flex-row items-center justify-center px-3 py-2">
                  <Text className="text-amber-700 text-xs font-semibold uppercase tracking-wider mb-1">
                    Requesting Domain:{" "}
                  </Text>
                  <Text className="text-amber-900 text-sm font-mono font-semibold">
                    {dappDomain}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
      <View className="flex-row gap-4">
        <Pressable
          className="flex-1 bg-light-main-container py-4 rounded-xl items-center"
          onPress={onClose}
        >
          <Text className="text-light-matte-black font-bold">Cancel</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-light-primary-red py-4 rounded-xl items-center"
          onPress={() => onConfirm(rememberChoice)}
        >
          <Text className="text-white font-bold">Continue</Text>
        </Pressable>
      </View>
    </BaseModal>
  );
};

export default SignMessageModal;

import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import {
  ArrowLeft,
  Clipboard as ClipboardIcon,
  Eye,
  EyeOff,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoadinngSpinnerPopup from "@/components/common/LoadinngSpinnerPopup";
import Bip39PasteWarningModal from "@/components/security/Bip39PasteWarningModal";
import VanityPrefixWarningModal from "@/components/security/VanityPrefixWarningModal";
import { useWallet } from "@/hooks/useWallet";
import { looksLikeBip39 } from "@/services/security/sensitivePaste";
import { checkVanityPrefixRisk } from "@/services/security/vanityPrefix";
import { createWalletFromParams } from "@/utils/walletUtils";

export default function ImportPrivateKeyScreen() {
  const [privateKey, setPrivateKey] = useState<string>("");
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const [vanityWarning, setVanityWarning] = useState<{
    address: string;
    description: string;
    privateKey: string;
  } | null>(null);
  const { addWallet } = useWallet();

  // TWV-2026-063 — commit a pasted private key. Private keys are also
  // sensitive even when the warning is specifically BIP-39-shaped, so we
  // clear the clipboard after any successful paste on this screen.
  const commitPrivateKeyPaste = (text: string) => {
    const privateKeyRegex = /^(0x)?[0-9a-fA-F]{64}$/;
    if (!privateKeyRegex.test(text)) {
      console.error("Invalid Private Key: Please paste a valid private key");
      return;
    }
    setPrivateKey(text);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      // Someone may paste a seed phrase onto the private-key screen by
      // mistake. The warning is still appropriate — steer them to the
      // seed-import screen rather than let the clipboard read pass
      // silently.
      if (looksLikeBip39(text)) {
        setPendingPaste(text);
        return;
      }
      commitPrivateKeyPaste(text);
      await Clipboard.setStringAsync("").catch(() => {});
    } catch (error) {
      console.error(error);
      console.error("Error: Failed to paste from clipboard");
    }
  };

  const handlePasteAnyway = async () => {
    const text = pendingPaste ?? "";
    setPendingPaste(null);
    commitPrivateKeyPaste(text);
    await Clipboard.setStringAsync("").catch(() => {});
  };

  const handleTypeInstead = async () => {
    setPendingPaste(null);
    await Clipboard.setStringAsync("").catch(() => {});
  };

  const finalizeImport = (pk: string) => {
    setIsLoading(true);
    setLoadingMessage("Importing your wallet...");

    setTimeout(() => {
      setLoadingMessage("Securing your private key with encryption...");
    }, 1500);

    setTimeout(() => {
      setLoadingMessage("Almost there! Finalizing your wallet setup...");
    }, 3500);

    addWallet({
      source: "PrivateKey",
      privateKey: pk,
      name: "My Wallet",
    })
      .then((success) => {
        setIsLoading(false);
        if (success) {
          console.log("Success: Wallet imported successfully");
          router.replace("/");
        } else {
          console.error("Error: Failed to import wallet");
        }
      })
      .catch((error) => {
        setIsLoading(false);
        console.error("Import error:", error);
        console.error(
          "Error: An unexpected error occurred during wallet import",
        );
      });
  };

  const handleImport = () => {
    const privateKeyRegex = /^(0x)?[0-9a-fA-F]{64}$/;
    if (!privateKeyRegex.test(privateKey)) {
      console.error("Invalid Private Key: Please enter a valid private key");
      return;
    }

    // TWV-2026-040 — check the derived address against the Profanity-
    // class heuristic. This is the highest-leverage screen for the
    // check because Profanity was itself a private-key generator.
    const draft = createWalletFromParams({
      source: "PrivateKey",
      privateKey: privateKey,
      name: "My Wallet",
    });
    if (draft) {
      const risk = checkVanityPrefixRisk(draft.address);
      if (risk.flagged && risk.description) {
        setVanityWarning({
          address: draft.address,
          description: risk.description,
          privateKey,
        });
        return;
      }
    }

    finalizeImport(privateKey);
  };

  const handleVanityAcknowledge = () => {
    const pending = vanityWarning;
    setVanityWarning(null);
    if (pending) finalizeImport(pending.privateKey);
  };

  const handleVanityCancel = () => setVanityWarning(null);
  return (
    <>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1 bg-light-main-container" edges={["top"]}>
        <ScrollView className="flex-1 p-6">
          <Pressable onPress={() => router.back()} className="mb-6">
            <ArrowLeft color="#c71c4b" size={24} />
          </Pressable>

          <Text className="text-light-matte-black text-3xl font-bold mb-6">
            Import with Private Key
          </Text>

          <View className="bg-light rounded-xl p-5 mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-light-matte-black font-medium">
                Enter your private key
              </Text>
              <Pressable
                className="flex-row items-center bg-light-primary-red/10 px-3 py-2 rounded-lg"
                onPress={handlePasteFromClipboard}
              >
                <ClipboardIcon size={16} color="#c71c4b" className="mr-2" />
                <Text className="text-light-primary-red font-medium">
                  Paste
                </Text>
              </Pressable>
            </View>

            <View className="relative mb-4">
              <TextInput
                className="bg-light-main-container p-4 pr-12 rounded-xl text-light-matte-black border border-light-matte-black/10"
                placeholder="Enter your private key"
                value={privateKey}
                onChangeText={setPrivateKey}
                secureTextEntry={!showPrivateKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                className="absolute right-3 top-4"
                onPress={() => setShowPrivateKey(!showPrivateKey)}
              >
                {showPrivateKey ? (
                  <EyeOff size={20} color="#c71c4b" />
                ) : (
                  <Eye size={20} color="#c71c4b" />
                )}
              </Pressable>
            </View>

            <View className="bg-light-primary-red/10 p-4 rounded-xl mb-4">
              <Text className="text-light-matte-black">
                Your private key is a sensitive piece of information. Never
                share it with anyone and keep it secure.
              </Text>
            </View>
          </View>

          <Pressable
            className={`bg-light-primary-red py-4 rounded-full items-center ${isLoading ? "opacity-70" : ""}`}
            onPress={handleImport}
            disabled={isLoading}
          >
            <Text className="text-light font-bold text-lg">Import Wallet</Text>
          </Pressable>
        </ScrollView>
        <LoadinngSpinnerPopup
          visible={isLoading}
          title="Setting Up Your Wallet"
          message={loadingMessage}
        />

        <Bip39PasteWarningModal
          visible={pendingPaste !== null}
          onPasteAnyway={handlePasteAnyway}
          onTypeInstead={handleTypeInstead}
        />

        <VanityPrefixWarningModal
          visible={vanityWarning !== null}
          address={vanityWarning?.address ?? ""}
          description={vanityWarning?.description ?? ""}
          onAcknowledge={handleVanityAcknowledge}
          onCancel={handleVanityCancel}
        />
      </SafeAreaView>
    </>
  );
}

import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Bip39PasteWarningModal from "@/components/security/Bip39PasteWarningModal";
import { SeedWordInput } from "@/components/security/SeedWordInput";
import VanityPrefixWarningModal from "@/components/security/VanityPrefixWarningModal";
import { useWallet } from "@/hooks/useWallet";
import { useScreenshotGuard } from "@/services/security/screenshotGuard";
import { looksLikeBip39 } from "@/services/security/sensitivePaste";
import { checkVanityPrefixRisk } from "@/services/security/vanityPrefix";
import { createWalletFromParams } from "@/utils/walletUtils";

interface WalletImportProps {
  type: "SeedPhrase" | "PrivateKey";
  title: string;
  placeholder: string;
  validationMessage: string;
  validateInput: (input: string) => boolean;
}

export default function WalletImport({
  type,
  title,
  placeholder,
  validationMessage,
  validateInput,
}: WalletImportProps) {
  useScreenshotGuard();
  const [input, setInput] = useState<string>("");
  const [walletName, setWalletName] = useState<string>("");
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const [vanityWarning, setVanityWarning] = useState<{
    address: string;
    description: string;
    input: string;
  } | null>(null);
  const { addWallet } = useWallet();

  // TWV-2026-063 — commit a validated paste + clear the clipboard.
  const commitPaste = (text: string) => {
    if (!validateInput(text)) {
      console.error("Invalid Input:", validationMessage);
      return;
    }
    setInput(text);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (looksLikeBip39(text)) {
        setPendingPaste(text);
        return;
      }
      commitPaste(text);
      await Clipboard.setStringAsync("").catch(() => {});
    } catch (error) {
      console.error(error);
      console.error("Error: Failed to paste from clipboard");
    }
  };

  const handlePasteAnyway = async () => {
    const text = pendingPaste ?? "";
    setPendingPaste(null);
    commitPaste(text);
    await Clipboard.setStringAsync("").catch(() => {});
  };

  const handleTypeInstead = async () => {
    setPendingPaste(null);
    await Clipboard.setStringAsync("").catch(() => {});
  };

  const finalizeImport = (rawInput: string) => {
    addWallet({
      source: type,
      [type === "SeedPhrase" ? "seedPhrase" : "privateKey"]: rawInput,
      name: walletName || undefined,
    }).then((success) => {
      if (success) {
        console.log("Success: Wallet imported successfully");
        router.replace("/");
      } else {
        console.error("Error: Failed to import wallet");
      }
    });
  };

  const handleImport = async () => {
    if (!validateInput(input)) {
      console.error("Invalid Input:", validationMessage);
      return;
    }

    // TWV-2026-040 — pre-derive the address to check it against the
    // Profanity-class heuristic before we finalise the import.
    const draft = await createWalletFromParams({
      source: type,
      [type === "SeedPhrase" ? "seedPhrase" : "privateKey"]: input,
      name: walletName || undefined,
    });
    if (draft) {
      const risk = checkVanityPrefixRisk(draft.address);
      if (risk.flagged && risk.description) {
        setVanityWarning({
          address: draft.address,
          description: risk.description,
          input,
        });
        return;
      }
    }

    finalizeImport(input);
  };

  const handleVanityAcknowledge = () => {
    const pending = vanityWarning;
    setVanityWarning(null);
    if (pending) finalizeImport(pending.input);
  };

  const handleVanityCancel = () => setVanityWarning(null);

  return (
    <View>
      <Text className="text-light-matte-black font-medium mb-2">{title}</Text>
      <SeedWordInput
        className="bg-light p-3 rounded-lg text-light-matte-black border border-light-matte-black/10 mb-4"
        value={input}
        onChangeText={setInput}
        placeholder={placeholder}
        multiline={type === "SeedPhrase"}
        numberOfLines={type === "SeedPhrase" ? 4 : 1}
        secureTextEntry={type === "PrivateKey"}
      />

      <Pressable
        className="bg-light-primary-red/10 px-3 py-2 rounded-lg self-start mb-4"
        onPress={handlePasteFromClipboard}
      >
        <Text className="text-light-primary-red font-medium">
          Paste from Clipboard
        </Text>
      </Pressable>

      <Text className="text-light-matte-black font-medium mb-2">
        Wallet Name (Optional)
      </Text>
      <TextInput
        className="bg-light p-3 rounded-lg text-light-matte-black border border-light-matte-black/10 mb-6"
        value={walletName}
        onChangeText={setWalletName}
        placeholder="Enter a name for this wallet"
      />

      <Pressable
        className="bg-light-primary-red py-4 rounded-full items-center"
        onPress={handleImport}
      >
        <Text className="text-light font-bold text-lg">Import Wallet</Text>
      </Pressable>

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
    </View>
  );
}

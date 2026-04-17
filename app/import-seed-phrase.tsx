import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowLeft, Clipboard as ClipboardIcon } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import LoadinngSpinnerPopup from "@/components/common/LoadinngSpinnerPopup";
import SeedPhraseGrid from "@/components/common/SeedPhraseGrid";
import Bip39PasteWarningModal from "@/components/security/Bip39PasteWarningModal";
import VanityPrefixWarningModal from "@/components/security/VanityPrefixWarningModal";
import { useWallet } from "@/hooks/useWallet";
import { looksLikeBip39 } from "@/services/security/sensitivePaste";
import { checkVanityPrefixRisk } from "@/services/security/vanityPrefix";
import { createWalletFromParams } from "@/utils/walletUtils";

export default function ImportWalletScreen() {
  const { bottom } = useSafeAreaInsets();
  const bottomOffset = Platform.OS === "ios" ? 0 : bottom > 0 ? bottom : 0;
  const [seedPhraseArray, setSeedPhraseArray] = useState<string[]>(
    Array(12).fill(""),
  );
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const [vanityWarning, setVanityWarning] = useState<{
    address: string;
    description: string;
    seedPhrase: string;
  } | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const { addWallet } = useWallet();

  const handleWordChange = (index: number, word: string) => {
    const newArray = [...seedPhraseArray];
    newArray[index] = word;
    setSeedPhraseArray(newArray);
  };

  // TWV-2026-063 — commit a pasted seed phrase. Clears the clipboard
  // regardless of which branch the user takes so the phrase does not
  // linger readable by other apps.
  const commitSeedPhrasePaste = (text: string) => {
    const words = text.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      console.error(
        "Invalid Seed Phrase: Please paste a valid 12 or 24-word seed phrase",
      );
      return;
    }
    setSeedPhraseArray(words);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (looksLikeBip39(text)) {
        // Defer commit until the user chooses. Do NOT auto-dismiss.
        setPendingPaste(text);
        return;
      }
      commitSeedPhrasePaste(text);
      // Tap-driven paste of seed-shaped material clears the clipboard.
      await Clipboard.setStringAsync("").catch(() => {});
    } catch (error) {
      console.log(error);
      console.error("Error: Failed to paste from clipboard");
    }
  };

  const handlePasteAnyway = async () => {
    const text = pendingPaste ?? "";
    setPendingPaste(null);
    commitSeedPhrasePaste(text);
    await Clipboard.setStringAsync("").catch(() => {});
  };

  const handleTypeInstead = async () => {
    setPendingPaste(null);
    // Still clear the clipboard — the seed phrase should not remain
    // readable by other apps just because the user declined to paste.
    await Clipboard.setStringAsync("").catch(() => {});
  };

  const finalizeImport = (seedPhrase: string) => {
    setIsLoading(true);
    setLoadingMessage("Importing your wallet...");

    setTimeout(() => {
      setLoadingMessage("Securing your recovery phrase with encryption...");
    }, 1500);

    setTimeout(() => {
      setLoadingMessage("Almost there! Finalizing your wallet setup...");
    }, 3500);

    addWallet({
      source: "SeedPhrase",
      seedPhrase: seedPhrase,
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

  const handleImport = async () => {
    const seedPhrase = seedPhraseArray.join(" ").trim();
    const words = seedPhrase.split(/\s+/);

    if (words.length !== 12 && words.length !== 24) {
      console.error(
        "Invalid Seed Phrase: Please enter a valid 12 or 24-word seed phrase",
      );
      return;
    }

    // TWV-2026-040 — pre-derive to run the vanity-prefix heuristic. Any
    // flag blocks finalization behind an explicit acknowledgement.
    const draft = await createWalletFromParams({
      source: "SeedPhrase",
      seedPhrase: seedPhrase,
      name: "My Wallet",
    });
    if (draft) {
      const risk = checkVanityPrefixRisk(draft.address);
      if (risk.flagged && risk.description) {
        setVanityWarning({
          address: draft.address,
          description: risk.description,
          seedPhrase,
        });
        return;
      }
    }

    finalizeImport(seedPhrase);
  };

  const handleVanityAcknowledge = () => {
    const pending = vanityWarning;
    setVanityWarning(null);
    if (pending) finalizeImport(pending.seedPhrase);
  };

  const handleVanityCancel = () => setVanityWarning(null);

  const scrollToInput = (index: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: 300 + index * 20,
        animated: true,
      });
    }, 300);
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        className="flex-1 bg-light-main-container"
        edges={["top"]}
        style={{ paddingBottom: bottomOffset }}
      >
        <View className="flex-1">
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 p-6"
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
          >
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
              className="mb-6"
            >
              <ArrowLeft color="#c71c4b" size={24} />
            </Pressable>

            <Text className="text-light-matte-black text-3xl font-bold mb-6">
              Import Wallet
            </Text>

            <View className="bg-light rounded-xl p-5 mb-6">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-light-matte-black font-medium">
                  Enter your seed phrase
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

              <SeedPhraseGrid
                mnemonic={seedPhraseArray}
                showCopyButton={false}
                editable={true}
                onWordPress={(index: number) => {
                  setCurrentWordIndex(index);
                  setCurrentWord(seedPhraseArray[index]);
                  scrollToInput(index);
                }}
              />

              {currentWordIndex !== null && (
                <KeyboardAvoidingView behavior="position">
                  <View className="bg-light-main-container p-4 rounded-xl mb-4">
                    <Text className="text-light-matte-black mb-2">
                      Word #{currentWordIndex + 1}
                    </Text>
                    <TextInput
                      className="bg-light p-3 rounded-lg text-light-matte-black border border-light-matte-black/10"
                      value={currentWord}
                      onChangeText={setCurrentWord}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (currentWord.trim()) {
                          handleWordChange(
                            currentWordIndex,
                            currentWord.trim(),
                          );
                          setCurrentWordIndex(null);
                          setCurrentWord("");
                          Keyboard.dismiss();
                        }
                      }}
                    />
                    <View className="flex-row justify-end mt-2">
                      <Pressable
                        className="bg-light-primary-red px-4 py-2 rounded-lg"
                        onPress={() => {
                          if (currentWord.trim()) {
                            handleWordChange(
                              currentWordIndex,
                              currentWord.trim(),
                            );
                            setCurrentWordIndex(null);
                            setCurrentWord("");
                            Keyboard.dismiss();
                          }
                        }}
                      >
                        <Text className="text-light font-medium">Save</Text>
                      </Pressable>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              )}
            </View>
            <View className="pb-2 bg-light-main-container">
              <Pressable
                className={`bg-light-primary-red py-4 rounded-full items-center ${isLoading ? "opacity-70" : ""}`}
                onPress={handleImport}
                disabled={isLoading}
              >
                <Text className="text-light font-bold text-lg">
                  Import Wallet
                </Text>
              </Pressable>
            </View>
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
        </View>
      </SafeAreaView>
    </>
  );
}

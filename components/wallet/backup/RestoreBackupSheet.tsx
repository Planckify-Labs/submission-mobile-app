import { CloudDownload, Eye, EyeOff, ShieldAlert } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BaseModal, ModalHeader } from "@/components/common/BaseModal";
import { BACKUP_ERROR_COPY, BackupError } from "@/services/backup/errors";
import { restoreSeed } from "@/services/backup/seedBackup";
import { useScreenshotGuard } from "@/services/security/screenshotGuard";

interface RestoreBackupSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Receives the decrypted mnemonic. Caller derives wallets and persists them. */
  onRestored: (mnemonic: string, createdAt: number) => void;
  /** Fallback path when the passphrase is lost or the blob is unreadable. */
  onUseSeedPhraseInstead: () => void;
  emailMasked?: string;
}

/**
 * Decrypts this Google account's Drive backup with the user's passphrase.
 *
 * The delay after a wrong attempt is UX, not security: an attacker who holds
 * the blob guesses offline where nothing we do here can slow them down. It
 * exists to stop a fat-fingered user hammering the KDF, which costs a second
 * of CPU each time.
 */
export default function RestoreBackupSheet({
  visible,
  onClose,
  onRestored,
  onUseSeedPhraseInstead,
  emailMasked,
}: RestoreBackupSheetProps) {
  const [passphrase, setPassphrase] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useScreenshotGuard(visible);

  const handleSubmit = useCallback(async () => {
    if (!passphrase || busy) return;
    setBusy(true);
    setError(null);

    try {
      const { mnemonic, createdAt } = await restoreSeed(passphrase);
      setPassphrase("");
      setAttempts(0);
      onRestored(mnemonic, createdAt);
    } catch (err) {
      setAttempts((a) => a + 1);
      setError(
        err instanceof BackupError
          ? BACKUP_ERROR_COPY[err.code]
          : BACKUP_ERROR_COPY.unknown,
      );
    } finally {
      setBusy(false);
    }
  }, [passphrase, busy, onRestored]);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      closeButtonDisabled={busy}
      height="auto"
      contentClassName="px-5"
    >
      <ModalHeader title="Restore your wallet" />

      <View className="pb-2">
        <View className="items-center mb-5">
          <View className="w-16 h-16 bg-light-primary-red/10 rounded-full items-center justify-center mb-4">
            <CloudDownload color="#c71c4b" size={28} />
          </View>
          <Text className="text-light-matte-black/70 text-center text-sm leading-5 max-w-80">
            We found an encrypted backup
            {emailMasked ? ` for ${emailMasked}` : ""}. Enter the passphrase you
            chose when you backed it up.
          </Text>
        </View>

        <View className="relative mb-3">
          <TextInput
            value={passphrase}
            onChangeText={(t) => {
              setPassphrase(t);
              if (error) setError(null);
            }}
            placeholder="Backup passphrase"
            placeholderTextColor="#9a9ca6"
            secureTextEntry={!reveal}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            editable={!busy}
            onSubmitEditing={handleSubmit}
            className="bg-light border border-light-matte-black/10 rounded-xl px-4 py-4 pr-12 text-light-matte-black"
          />
          <TouchableOpacity
            className="absolute right-4 top-4"
            onPress={() => setReveal((r) => !r)}
            hitSlop={8}
          >
            {reveal ? (
              <EyeOff color="#7a7d8a" size={18} />
            ) : (
              <Eye color="#7a7d8a" size={18} />
            )}
          </TouchableOpacity>
        </View>

        <View className="min-h-8 mb-3">
          {error && (
            <View className="flex-row items-start">
              <ShieldAlert color="#c71c4b" size={16} />
              <Text className="text-light-primary-red text-sm ml-2 flex-1">
                {error}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          className={`py-4 rounded-xl items-center mb-3 ${
            passphrase && !busy
              ? "bg-light-primary-red"
              : "bg-light-matte-black/10"
          }`}
          onPress={handleSubmit}
          disabled={!passphrase || busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              className={`font-semibold ${
                passphrase ? "text-light" : "text-light-matte-black/40"
              }`}
            >
              Decrypt and restore
            </Text>
          )}
        </TouchableOpacity>

        {/* Surfaced only once they've actually struggled — offering the escape
            hatch immediately would nudge users away from the backup they just
            successfully found. */}
        {attempts >= 2 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onUseSeedPhraseInstead}
            disabled={busy}
            className="py-3 items-center"
          >
            <Text className="text-light-primary-red text-sm font-semibold">
              Use my seed phrase instead
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </BaseModal>
  );
}

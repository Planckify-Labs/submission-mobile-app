import * as Clipboard from "expo-clipboard";
import React, { useCallback } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import type { SuiSignInPayload } from "@/services/chains/sui/payloads";
import { useScreenshotGuard } from "@/services/security/screenshotGuard";
import { ApprovalShell } from "./ApprovalShell";
import { PrimaryActions, SheetModal } from "./SheetModal";
import { useBiometricApproval } from "./useBiometricApproval";

interface Props {
  intent: ApprovalIntent<SuiSignInPayload & { message?: string }>;
  onDecision: (d: ApprovalDecision) => void;
}

export function SuiSignInSheet({
  intent,
  onDecision,
}: Props): React.ReactElement {
  useScreenshotGuard();
  const p = intent.payload;
  const canonical = p.message;

  const copyCanonical = async (): Promise<void> => {
    if (canonical) await Clipboard.setStringAsync(canonical);
  };

  const approve = useCallback(
    () => onDecision({ id: intent.id, outcome: "approve" }),
    [intent.id, onDecision],
  );
  const { gatedApprove, pending, error } = useBiometricApproval(
    "Sign in with Sui",
    approve,
  );

  return (
    <SheetModal
      onDismiss={() => onDecision({ id: intent.id, outcome: "reject" })}
    >
      <ApprovalShell intent={intent} title="Sign in with Sui">
        <ScrollView className="flex-1">
          <View className="bg-gray-50 rounded-xl p-3 mb-2">
            <Text className="text-xs text-gray-500">Domain</Text>
            <Text className="text-sm text-gray-900" selectable>
              {p.domain}
            </Text>
          </View>
          {p.statement ? (
            <View className="bg-gray-50 rounded-xl p-3 mb-2">
              <Text className="text-xs text-gray-500">Statement</Text>
              <Text className="text-sm text-gray-900" selectable>
                {p.statement}
              </Text>
            </View>
          ) : null}
          {canonical ? (
            <View className="bg-gray-50 rounded-xl p-3 mb-2">
              <Text className="text-xs text-gray-500 mb-1">
                Canonical SIWS message
              </Text>
              <Text className="text-xs font-mono text-gray-800" selectable>
                {canonical}
              </Text>
              <TouchableOpacity onPress={copyCanonical} className="mt-2">
                <Text className="text-xs text-violet-700">Copy message</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-2 mb-2">
            {p.expirationTime ? (
              <View className="bg-gray-100 rounded-full px-3 py-1">
                <Text className="text-xs text-gray-700">
                  Expires {p.expirationTime}
                </Text>
              </View>
            ) : null}
            {p.notBefore ? (
              <View className="bg-gray-100 rounded-full px-3 py-1">
                <Text className="text-xs text-gray-700">
                  Not before {p.notBefore}
                </Text>
              </View>
            ) : null}
            {p.chainId ? (
              <View className="bg-blue-50 rounded-full px-3 py-1">
                <Text className="text-xs text-blue-700">sui:{p.chainId}</Text>
              </View>
            ) : null}
          </View>
          {error && <Text className="text-xs text-red-600 mt-2">{error}</Text>}
        </ScrollView>
      </ApprovalShell>
      <PrimaryActions
        approveLabel={pending ? "Authenticating…" : "Sign in"}
        onApprove={() => {
          void gatedApprove();
        }}
        onReject={() => onDecision({ id: intent.id, outcome: "reject" })}
        loading={pending}
      />
    </SheetModal>
  );
}

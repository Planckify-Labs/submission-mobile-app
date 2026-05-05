import { ArrowRight } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import type {
  SuiNetwork,
  SuiSwitchNetworkPayload,
} from "@/services/chains/sui/payloads";
import { ApprovalShell } from "./ApprovalShell";
import { PrimaryActions, SheetModal } from "./SheetModal";

interface Props {
  intent: ApprovalIntent<SuiSwitchNetworkPayload>;
  onDecision: (d: ApprovalDecision) => void;
}

const LABEL: Record<SuiNetwork, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
  devnet: "Devnet",
};

export function SuiSwitchNetworkSheet({
  intent,
  onDecision,
}: Props): React.ReactElement {
  const { from, to } = intent.payload;
  return (
    <SheetModal
      onDismiss={() => onDecision({ id: intent.id, outcome: "reject" })}
    >
      <ApprovalShell intent={intent} title="Switch Sui network">
        <Text className="text-sm text-gray-600 mb-3">
          This site is asking to switch the active Sui network.
        </Text>
        <View className="flex-row items-center justify-center py-4 bg-gray-50 rounded-xl">
          <View className="px-3 py-1 rounded-full bg-white border border-gray-200">
            <Text className="text-sm text-gray-800">{LABEL[from]}</Text>
          </View>
          <ArrowRight size={18} color="#111" style={{ marginHorizontal: 12 }} />
          <View className="px-3 py-1 rounded-full bg-blue-100">
            <Text className="text-sm font-medium text-blue-800">
              {LABEL[to]}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-gray-500 mt-3">
          Signing permissions are scoped per network — you&apos;ll be asked to
          reconnect on {LABEL[to]} if no grant exists yet.
        </Text>
      </ApprovalShell>
      <PrimaryActions
        approveLabel={`Switch to ${LABEL[to]}`}
        onApprove={() => onDecision({ id: intent.id, outcome: "approve" })}
        onReject={() => onDecision({ id: intent.id, outcome: "reject" })}
      />
    </SheetModal>
  );
}

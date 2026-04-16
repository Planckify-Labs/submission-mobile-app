import React from "react";
import { Text, View } from "react-native";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import type { EvmAuthorizationPayload } from "@/services/chains/evm/payloads";
import { ApprovalShell } from "./ApprovalShell";
import { PrimaryActions, SheetModal } from "./SheetModal";

interface Props {
  intent: ApprovalIntent<EvmAuthorizationPayload>;
  onDecision: (d: ApprovalDecision) => void;
}

export function AuthorizationSheet({
  intent,
  onDecision,
}: Props): React.ReactElement {
  const p = intent.payload;
  const expires = p.expiresAt
    ? new Date(p.expiresAt).toLocaleString()
    : "24 hours";
  return (
    <SheetModal
      onDismiss={() => onDecision({ id: intent.id, outcome: "reject" })}
    >
      <ApprovalShell intent={intent} title="Rewire wallet (EIP-7702)">
        <View className="bg-red-50 border border-red-300 rounded-xl p-3">
          <Text className="text-xs font-bold text-red-800 uppercase">
            Warning — rewires your entire account
          </Text>
          {/*
            TWV-2026-010 — required copy. All future calls to the user's
            address run code at the delegate. Drainers exploit this by
            advertising as a "smart account upgrade" while installing a
            sweep-on-receive hook.
          */}
          <Text className="text-sm text-red-900 mt-1">
            This REWIRES your wallet. All future calls to your address will run
            code at the contract below. A malicious delegate can sweep every
            asset you receive.
          </Text>
        </View>
        <View className="bg-amber-50 rounded-xl p-3 mt-3">
          <Text className="text-xs text-gray-500">Delegate contract</Text>
          <Text className="text-sm text-gray-900 mb-2" selectable>
            {p.delegator}
          </Text>
          <Text className="text-xs text-gray-500">Chain</Text>
          <Text className="text-sm text-gray-900 mb-2">{p.chainId}</Text>
          <Text className="text-xs text-gray-500">Nonce</Text>
          <Text className="text-sm text-gray-900 mb-2">{p.nonce}</Text>
          <Text className="text-xs text-gray-500">Expires</Text>
          <Text className="text-sm text-gray-900">{expires}</Text>
        </View>
      </ApprovalShell>
      <PrimaryActions
        approveLabel="Rewire wallet"
        onApprove={() => onDecision({ id: intent.id, outcome: "approve" })}
        onReject={() => onDecision({ id: intent.id, outcome: "reject" })}
      />
    </SheetModal>
  );
}

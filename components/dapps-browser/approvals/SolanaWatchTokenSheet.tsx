import React from "react";
import { Text, View } from "react-native";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import type { SolanaWatchTokenPayload } from "@/services/chains/solana/payloads";
import { truncateAddress } from "@/utils/walletUtils";
import { ApprovalShell } from "./ApprovalShell";
import { RiskBanner } from "./RiskBanner";
import { PrimaryActions, SheetModal } from "./SheetModal";

interface Props {
  intent: ApprovalIntent<SolanaWatchTokenPayload>;
  onDecision: (d: ApprovalDecision) => void;
}

interface Row {
  label: string;
  claimed: string | undefined;
  verified: string | undefined;
}

function Cell({
  value,
  mismatch,
}: {
  value: string | undefined;
  mismatch: boolean;
}): React.ReactElement {
  return (
    <Text
      className={`text-sm ${mismatch ? "text-amber-900 font-semibold" : "text-gray-800"}`}
    >
      {value ?? "—"}
    </Text>
  );
}

export function SolanaWatchTokenSheet({
  intent,
  onDecision,
}: Props): React.ReactElement {
  const p = intent.payload;
  const verified = p.verified;

  const rows: Row[] = [
    {
      label: "Symbol",
      claimed: p.symbol,
      verified: undefined, // symbol isn't returned by getAccountInfo; remains dApp-provided.
    },
    {
      label: "Name",
      claimed: p.name,
      verified: undefined,
    },
    {
      label: "Decimals",
      claimed: p.decimals !== undefined ? String(p.decimals) : undefined,
      verified: undefined,
    },
    {
      label: "Standard",
      claimed: p.tokenStandard,
      verified: verified?.mintOwner,
    },
  ];

  const hasMismatch = rows.some(
    (r) => r.verified !== undefined && r.claimed !== undefined && r.verified !== r.claimed,
  );

  return (
    <SheetModal
      onDismiss={() => onDecision({ id: intent.id, outcome: "reject" })}
    >
      <ApprovalShell intent={intent} title="Add Solana token">
        {hasMismatch && (
          <RiskBanner
            annotations={[
              {
                code: "watchToken.metadata-mismatch",
                severity: "warn",
                title: "dApp metadata disagrees with on-chain",
                detail:
                  "The site-supplied values below differ from what the mint account reports. Proceed only if you expected this.",
                source: "local",
              },
            ]}
          />
        )}
        <Text className="text-xs text-gray-500 mb-2">Mint</Text>
        <Text className="text-sm font-mono text-gray-900 mb-3" selectable>
          {truncateAddress({ address: p.mint, preset: "medium" })}
        </Text>
        <View className="border border-gray-200 rounded-xl overflow-hidden">
          <View className="flex-row bg-gray-50 px-3 py-2">
            <Text className="flex-1 text-xs font-medium text-gray-500">
              Field
            </Text>
            <Text className="flex-1 text-xs font-medium text-gray-500">
              dApp says
            </Text>
            <Text className="flex-1 text-xs font-medium text-gray-500">
              On-chain
            </Text>
          </View>
          {rows.map((r) => {
            const mismatch =
              r.verified !== undefined &&
              r.claimed !== undefined &&
              r.verified !== r.claimed;
            return (
              <View
                key={r.label}
                className="flex-row px-3 py-2 border-t border-gray-100"
              >
                <Text className="flex-1 text-sm text-gray-700">{r.label}</Text>
                <View className="flex-1">
                  <Cell value={r.claimed} mismatch={mismatch} />
                </View>
                <View className="flex-1">
                  <Cell value={r.verified} mismatch={mismatch} />
                </View>
              </View>
            );
          })}
        </View>
        {verified?.extensions && verified.extensions.length > 0 && (
          <View className="mt-3">
            <Text className="text-xs font-medium text-gray-500 mb-1">
              Token-2022 extensions
            </Text>
            {verified.extensions.map((e) => (
              <Text key={e} className="text-xs text-gray-700">
                · {e}
              </Text>
            ))}
          </View>
        )}
      </ApprovalShell>
      <PrimaryActions
        approveLabel="Add token"
        onApprove={() => onDecision({ id: intent.id, outcome: "approve" })}
        onReject={() => onDecision({ id: intent.id, outcome: "reject" })}
      />
    </SheetModal>
  );
}

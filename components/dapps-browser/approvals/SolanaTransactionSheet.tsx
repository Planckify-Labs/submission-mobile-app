import React, { useCallback } from "react";
import { ScrollView, Text, View } from "react-native";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import type {
  SolanaCluster,
  SolanaDecodedInstruction,
  SolanaSignTxPayload,
  SolanaSimulationSummary,
} from "@/services/chains/solana/payloads";
import { isJitoTipAccount } from "@/services/chains/solana/jitoTipAccounts";
import { truncateAddress } from "@/utils/walletUtils";
import { ApprovalShell } from "./ApprovalShell";
import { RiskBanner } from "./RiskBanner";
import { PrimaryActions, SheetModal } from "./SheetModal";
import { useBiometricApproval } from "./useBiometricApproval";

interface Props {
  intent: ApprovalIntent<SolanaSignTxPayload>;
  onDecision: (d: ApprovalDecision) => void;
}

const CLUSTER_LABEL: Record<SolanaCluster, string> = {
  "mainnet-beta": "Mainnet",
  devnet: "Devnet",
  testnet: "Testnet",
};

function ComputeBudgetRow({
  decoded,
}: {
  decoded?: SolanaDecodedInstruction[];
}): React.ReactElement | null {
  if (!decoded) return null;
  const limit = decoded.find(
    (d) =>
      d.program === "compute-budget" && d.kind === "setComputeUnitLimit",
  );
  const price = decoded.find(
    (d) =>
      d.program === "compute-budget" && d.kind === "setComputeUnitPrice",
  );
  if (!limit && !price) return null;
  const limitValue =
    limit && "value" in limit ? Number(limit.value) : undefined;
  const priceValue =
    price && "value" in price ? Number(price.value) : undefined;
  const priorityFeeLamports =
    limitValue !== undefined && priceValue !== undefined
      ? Math.ceil((limitValue * priceValue) / 1_000_000)
      : undefined;
  return (
    <View className="border border-gray-200 rounded-xl p-3 mt-2">
      <Text className="text-xs text-gray-500 mb-1">Compute budget</Text>
      {limitValue !== undefined && (
        <Text className="text-xs text-gray-700">
          Unit limit: {limitValue.toLocaleString()}
        </Text>
      )}
      {priceValue !== undefined && (
        <Text className="text-xs text-gray-700">
          Unit price: {priceValue} μlamports/CU
        </Text>
      )}
      {priorityFeeLamports !== undefined && (
        <Text className="text-xs text-gray-900 mt-1 font-medium">
          Est. priority fee: {priorityFeeLamports.toLocaleString()} lamports
        </Text>
      )}
    </View>
  );
}

function JitoTipRow({
  decoded,
}: {
  decoded?: SolanaDecodedInstruction[];
}): React.ReactElement | null {
  if (!decoded) return null;
  // System transfer whose destination is a Jito tip account.
  const tipTransfer = decoded.find((d) => {
    if (d.program !== "system" || d.kind !== "transfer") return false;
    const data = (d as { data: { to?: string; lamports?: bigint } }).data;
    return typeof data.to === "string" && isJitoTipAccount(data.to);
  });
  if (!tipTransfer) return null;
  const data = (tipTransfer as { data: { to: string; lamports?: bigint } }).data;
  return (
    <View className="border border-amber-200 bg-amber-50 rounded-xl p-3 mt-2">
      <Text className="text-xs text-amber-900 font-medium">Jito MEV tip</Text>
      <Text className="text-xs text-amber-800 mt-1">
        {typeof data.lamports === "bigint"
          ? `${data.lamports.toString()} lamports`
          : "tip"} →{" "}
        {truncateAddress({ address: data.to, preset: "medium" })}
      </Text>
    </View>
  );
}

function SimulationRow({
  s,
}: {
  s?: SolanaSimulationSummary;
}): React.ReactElement | null {
  if (!s) return null;
  return (
    <View className="border border-gray-200 rounded-xl p-3 mt-2">
      <Text className="text-xs text-gray-500 mb-1">Simulation</Text>
      {s.unitsConsumed !== undefined && (
        <Text className="text-xs text-gray-700">
          Units consumed: {s.unitsConsumed.toLocaleString()}
        </Text>
      )}
      {s.balanceChanges.length > 0 && (
        <Text className="text-xs text-gray-700 mt-1">
          Balance changes: {s.balanceChanges.length}
        </Text>
      )}
      {s.tokenChanges.length > 0 && (
        <Text className="text-xs text-gray-700">
          Token changes: {s.tokenChanges.length}
        </Text>
      )}
      {s.warnings.length > 0 && (
        <Text className="text-xs text-amber-800 mt-1">
          {s.warnings.length} warning(s) — see risk banner.
        </Text>
      )}
    </View>
  );
}

function DecodedList({
  decoded,
}: {
  decoded?: SolanaDecodedInstruction[];
}): React.ReactElement | null {
  if (!decoded || decoded.length === 0) return null;
  return (
    <View className="border border-gray-200 rounded-xl p-3 mt-2">
      <Text className="text-xs text-gray-500 mb-1">Decoded instructions</Text>
      {decoded.map((ix, i) => (
        <Text key={`${i}-${ix.program}`} className="text-xs text-gray-700">
          {i + 1}. {ix.program} · {"kind" in ix ? ix.kind : "memo"}
        </Text>
      ))}
    </View>
  );
}

export function SolanaTransactionSheet({
  intent,
  onDecision,
}: Props): React.ReactElement {
  const p = intent.payload;
  const approve = useCallback(
    () => onDecision({ id: intent.id, outcome: "approve" }),
    [intent.id, onDecision],
  );
  const reason =
    p.mode === "sign-and-send"
      ? `Sign & send on ${CLUSTER_LABEL[p.cluster]}`
      : `Sign transaction on ${CLUSTER_LABEL[p.cluster]}`;
  const { gatedApprove, pending, error } = useBiometricApproval(
    reason,
    approve,
  );

  return (
    <SheetModal
      onDismiss={() => onDecision({ id: intent.id, outcome: "reject" })}
    >
      <ApprovalShell intent={intent} title="Approve Solana transaction">
        <RiskBanner annotations={intent.annotations} />
        <ScrollView className="flex-1">
          <View className="flex-row items-center mb-3">
            <View className="px-2 py-0.5 rounded-full bg-violet-100">
              <Text className="text-xs font-medium text-violet-700">
                Solana · {CLUSTER_LABEL[p.cluster]}
              </Text>
            </View>
            <View className="ml-2 px-2 py-0.5 rounded-full bg-gray-100">
              <Text className="text-xs text-gray-700">
                {p.mode === "sign-and-send" ? "Sign & send" : "Sign only"}
              </Text>
            </View>
            <View className="ml-2 px-2 py-0.5 rounded-full bg-gray-100">
              <Text className="text-xs text-gray-700">
                {p.version === 0 ? "v0" : "legacy"}
              </Text>
            </View>
          </View>
          <View className="bg-gray-50 rounded-xl p-3">
            <Text className="text-xs text-gray-500">Fee payer</Text>
            <Text className="text-sm text-gray-900 mb-2" selectable>
              {truncateAddress({ address: p.address, preset: "medium" })}
            </Text>
            <Text className="text-xs text-gray-500">
              Transaction (base64, truncated)
            </Text>
            <Text
              className="text-xs font-mono text-gray-700"
              selectable
              numberOfLines={3}
            >
              {p.transaction.slice(0, 120)}
              {p.transaction.length > 120 ? "…" : ""}
            </Text>
          </View>
          <DecodedList decoded={p.decoded} />
          <ComputeBudgetRow decoded={p.decoded} />
          <JitoTipRow decoded={p.decoded} />
          <SimulationRow s={p.simulation} />
          {error && (
            <Text className="text-xs text-red-600 mt-2">{error}</Text>
          )}
        </ScrollView>
      </ApprovalShell>
      <PrimaryActions
        approveLabel={
          pending
            ? "Authenticating…"
            : p.mode === "sign-and-send"
              ? "Sign & send"
              : "Sign"
        }
        onApprove={() => {
          void gatedApprove();
        }}
        onReject={() => onDecision({ id: intent.id, outcome: "reject" })}
        loading={pending}
      />
    </SheetModal>
  );
}

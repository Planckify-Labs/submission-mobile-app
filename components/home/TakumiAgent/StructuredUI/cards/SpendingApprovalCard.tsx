/**
 * SpendingApprovalCard — inline human-in-the-loop approval card.
 *
 * Replaces the modal-based `SpendingApprovalModal` for spending decisions
 * so the outcome lives in the tool's `output` and survives reload as a
 * historical receipt (spec §2 principle 6, §4.2.2).
 */

import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react-native";
import type React from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ToolComponentProps } from "../types";

type SpendingApprovalInput = {
  amount?: string;
  token?: string;
  token_symbol?: string;
  spender?: string;
  spender_name?: string;
  human_summary?: string;
};

type SpendingApprovalOutput = {
  decision: "approved" | "rejected";
  unlimited?: boolean;
};

const SUCCESS_GREEN = "#10b981";
const BRAND_RED = "#c71c4b";
const MUTED_GRAY = "#6b7280";

function summarize(input: SpendingApprovalInput): string {
  if (input.human_summary) return input.human_summary;
  const amount = input.amount ?? "";
  const token = input.token_symbol ?? input.token ?? "";
  const parts: string[] = [];
  if (amount) parts.push(amount);
  if (token) parts.push(token);
  if (input.spender_name) parts.push(`to ${input.spender_name}`);
  return parts.join(" ").trim() || "spending request";
}

function FrozenReceipt({
  input,
  output,
}: {
  input: SpendingApprovalInput;
  output: SpendingApprovalOutput | undefined;
}) {
  const summary = summarize(input);
  const approved = output?.decision === "approved";
  return (
    <View
      className={`my-1.5 rounded-2xl border px-3.5 py-2.5 ${
        approved
          ? "bg-green-50/60 border-green-200"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <View className="flex-row items-center gap-2">
        {approved ? (
          <CheckCircle2 size={16} color={SUCCESS_GREEN} />
        ) : (
          <XCircle size={16} color={MUTED_GRAY} />
        )}
        <Text
          className={`text-xs font-bold uppercase tracking-wide ${
            approved ? "text-green-700" : "text-gray-500"
          }`}
        >
          {approved ? "Approved" : "Rejected"}
        </Text>
      </View>
      <Text className="text-sm text-light-matte-black/80 mt-1.5">
        {summary}
      </Text>
    </View>
  );
}

const SpendingApprovalCard: React.FC<
  ToolComponentProps<SpendingApprovalInput, SpendingApprovalOutput>
> = ({ state, input, output, mode, addToolResult }) => {
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);

  if (mode === "historical") {
    return <FrozenReceipt input={input} output={output} />;
  }

  if (state === "output-available" && output) {
    return <FrozenReceipt input={input} output={output} />;
  }

  if (state === "output-error") {
    return (
      <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <XCircle size={16} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
            Approval failed
          </Text>
        </View>
        <Text className="text-sm text-light-matte-black/80 mt-1.5">
          {summarize(input)}
        </Text>
      </View>
    );
  }

  // Live + input-available — interactive approval card.
  const summary = summarize(input);
  const onApprove = () => {
    if (!addToolResult) return;
    setPending("approved");
    addToolResult({ decision: "approved" });
  };
  const onReject = () => {
    if (!addToolResult) return;
    setPending("rejected");
    addToolResult({ decision: "rejected" });
  };

  return (
    <View className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3">
      <View className="flex-row items-center gap-2">
        <ShieldAlert size={16} color={BRAND_RED} />
        <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
          Approval required
        </Text>
      </View>
      <Text className="text-sm text-light-matte-black mt-1.5">{summary}</Text>
      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={onReject}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel="Reject"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 active:opacity-70"
        >
          <Text className="text-xs font-semibold text-light-matte-black text-center">
            {pending === "rejected" ? "Rejecting…" : "Reject"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel="Approve"
          className="flex-1 rounded-xl bg-light-primary-red px-3 py-2 active:opacity-80"
        >
          <Text className="text-xs font-semibold text-white text-center">
            {pending === "approved" ? "Approving…" : "Approve"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default SpendingApprovalCard;

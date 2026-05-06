import React from "react";
import { View } from "react-native";
import type { AgentMessage } from "@/services/agent-messages/types";
import MarkdownMessage from "./MarkdownMessage";
import PlainTextMessage from "./PlainTextMessage";
import { BALANCE_TOOL_NAMES, toolComponents } from "./StructuredUI";
import { normalizeWalletBalancesOutput } from "./StructuredUI/cards/BalancesCard";

interface MessageContentProps {
  message: AgentMessage;
  mode: "live" | "historical";
  addToolResult?: (toolCallId: string, output: unknown) => void;
}

/**
 * The set of (namespace, chain_id, token-address, symbol) tuples a
 * balance-tool result paints. Used by the dedupe pass below to suppress
 * any card whose entries are a (non-strict) subset of another card's
 * — the LLM frequently calls `get_wallet_balance` (native only) and
 * then `get_wallet_tokens` (native + ERC20s) in the same turn, and
 * the second card's entries cover the first.
 *
 * Returns `null` when no normalized payload is present (loading
 * skeleton, error) — those cards always render.
 */
function balanceEntries(output: unknown): Set<string> | null {
  if (!output || typeof output !== "object") return null;
  try {
    const normalized = normalizeWalletBalancesOutput(output as never);
    const payload = normalized.display ?? normalized.data;
    if (!payload?.groups?.length) return null;
    const entries = new Set<string>();
    for (const g of payload.groups) {
      const ns = g.namespace;
      const cid = String(g.chain_id ?? "");
      for (const t of g.tokens ?? []) {
        const addr = (t.address ?? "").toLowerCase();
        // Symbol included to distinguish addr-less native rows across
        // namespaces ("" + ETH vs "" + SOL).
        entries.add(`${ns}|${cid}|${addr}|${t.symbol}`);
      }
    }
    return entries.size > 0 ? entries : null;
  } catch {
    return null;
  }
}

function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
  if (a.size > b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Decide which balance-tool parts to suppress. A part is suppressed
 * when another part in the same message holds entries that are a
 * superset of it — strict superset wins outright; on ties, the
 * earlier part wins so narrative order is preserved.
 */
function computeSuppressedToolParts(message: AgentMessage): Set<string> {
  const balances: Array<{
    toolCallId: string;
    index: number;
    entries: Set<string>;
  }> = [];
  message.parts.forEach((part, index) => {
    if (part.type !== "tool") return;
    if (!BALANCE_TOOL_NAMES.has(part.toolName)) return;
    const entries = balanceEntries(part.output);
    if (!entries) return;
    balances.push({ toolCallId: part.toolCallId, index, entries });
  });

  const suppressed = new Set<string>();
  for (const a of balances) {
    for (const b of balances) {
      if (a.toolCallId === b.toolCallId) continue;
      if (!isSubsetOf(a.entries, b.entries)) continue;
      const strictSubset = a.entries.size < b.entries.size;
      // Equal entries: keep the earlier card, drop later duplicates.
      // Strict subset: drop A regardless of order.
      if (strictSubset || a.index > b.index) {
        suppressed.add(a.toolCallId);
        break;
      }
    }
  }
  return suppressed;
}

const MessageContent: React.FC<MessageContentProps> = React.memo(
  ({ message, mode, addToolResult }) => {
    const isUser = message.role === "user";
    const suppressedBalanceParts = computeSuppressedToolParts(message);

    return (
      <View className="w-full">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return <PlainTextMessage key={`text-${i}`} content={part.text} />;
            }
            return <MarkdownMessage key={`text-${i}`} content={part.text} />;
          }

          if (part.type === "tool") {
            const Component = toolComponents[part.toolName];
            if (!Component) return null;
            if (suppressedBalanceParts.has(part.toolCallId)) return null;

            const liveCallback =
              mode === "live" && addToolResult
                ? (output: unknown) => addToolResult(part.toolCallId, output)
                : undefined;
            return (
              <Component
                key={part.toolCallId}
                state={part.state}
                input={part.input}
                output={part.output}
                error={part.error}
                mode={mode}
                addToolResult={liveCallback}
              />
            );
          }

          return null;
        })}
      </View>
    );
  },
);

MessageContent.displayName = "MessageContent";

export default MessageContent;

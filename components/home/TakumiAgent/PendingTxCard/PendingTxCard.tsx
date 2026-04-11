/**
 * PendingTxCard — task 15 optimistic-UI card rendered inline in the
 * Takumi Agent chat thread.
 *
 * Spec: `AGENT_PROTOCOL.md` §1 "Why Blockchain is a separate actor",
 * §10 "Optimistic UI Pattern", §7 "Honesty" (error strings rendered
 * verbatim, never softened).
 *
 * Visual contract per `tasks/15_optimistic_ui_istaken_true.md`:
 *
 *   - submitted: spinner + "Submitting to the network…" + truncated
 *     hash + copy button + tap → explorer.
 *   - confirmed: success checkmark + "Confirmed in block N" + relative
 *     time since confirmation + tap → explorer.
 *   - failed: destructive icon + verbatim `error` string; tap →
 *     explorer IFF a hash was actually produced before the failure.
 *
 * Styling mirrors the sibling `PreviewCard` — same brand tokens, same
 * rounded-2xl-border-soft pattern — so the thread reads as one design
 * language. No new tokens invented here.
 */

import { formatDistanceToNowStrict } from "date-fns";
import * as Linking from "expo-linking";
import { CheckCircle2, Copy, ExternalLink, XCircle } from "lucide-react-native";
import type React from "react";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { PendingTxRecord } from "@/services/pendingTxStore";
import { copyToClipboard } from "@/utils/helperUtils";
import { buildExplorerUrl } from "./explorerUrl";

// Brand tokens — mirror PreviewCard, which is the reference card in
// the same thread. Do not invent new tokens here.
const SUCCESS_GREEN = "#10b981";
const BRAND_RED = "#c71c4b";
const MUTED_GRAY = "#6b7280";
const MATTE_BLACK = "#20222c";

export interface PendingTxCardProps {
  record: PendingTxRecord;
}

function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

const PendingTxCard: React.FC<PendingTxCardProps> = ({ record }) => {
  const explorerUrl = useMemo(
    () => buildExplorerUrl(record.chain_id, record.tx_hash),
    [record.chain_id, record.tx_hash],
  );

  const canOpenExplorer = typeof explorerUrl === "string";

  const handleOpenExplorer = () => {
    if (!canOpenExplorer || !explorerUrl) return;
    // Fire-and-forget — `Linking.openURL` rejects on unsupported
    // schemes, which we swallow since the tap is non-critical UX.
    Linking.openURL(explorerUrl).catch((err) => {
      console.warn(`[PendingTxCard] failed to open explorer: ${String(err)}`);
    });
  };

  const handleCopyHash = () => {
    copyToClipboard(record.tx_hash, "Transaction hash");
  };

  const relativeConfirmedAt = useMemo(() => {
    if (!record.confirmed_at) return null;
    try {
      return formatDistanceToNowStrict(new Date(record.confirmed_at), {
        addSuffix: true,
      });
    } catch {
      return null;
    }
  }, [record.confirmed_at]);

  // ------------------------------------------------------------------
  // Per-state content.
  // ------------------------------------------------------------------

  if (record.state === "confirmed") {
    const blockLabel =
      typeof record.block_number === "number"
        ? `Confirmed in block ${record.block_number}`
        : "Confirmed";
    const a11yLabel = `Transaction confirmed. ${record.description}.${
      relativeConfirmedAt ? ` ${relativeConfirmedAt}.` : ""
    }${canOpenExplorer ? " Double-tap to open block explorer." : ""}`;
    return (
      <Pressable
        accessible
        accessibilityRole={canOpenExplorer ? "button" : "text"}
        accessibilityLabel={a11yLabel}
        disabled={!canOpenExplorer}
        onPress={handleOpenExplorer}
        className="my-1.5 rounded-2xl border border-green-200 bg-green-50/60 px-3.5 py-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <CheckCircle2 size={16} color={SUCCESS_GREEN} />
          <Text className="text-xs font-bold uppercase tracking-wide text-green-700">
            {blockLabel}
          </Text>
          {relativeConfirmedAt ? (
            <Text className="text-[11px] text-gray-500 ml-auto">
              {relativeConfirmedAt}
            </Text>
          ) : null}
        </View>
        <Text
          className="text-sm text-light-matte-black/80 mt-1.5"
          style={{ color: MATTE_BLACK }}
          numberOfLines={0}
        >
          {record.description}
        </Text>
        <View className="flex-row items-center gap-2 mt-2">
          <Text className="text-[11px] text-gray-500 flex-1" numberOfLines={1}>
            {truncateHash(record.tx_hash)}
          </Text>
          {canOpenExplorer ? (
            <ExternalLink size={12} color={MUTED_GRAY} />
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (record.state === "failed") {
    const a11yLabel = `Transaction failed. ${record.description}. ${
      record.error ?? ""
    }${canOpenExplorer ? " Double-tap to open block explorer." : ""}`;
    return (
      <Pressable
        accessible
        accessibilityRole={canOpenExplorer ? "button" : "text"}
        accessibilityLabel={a11yLabel}
        disabled={!canOpenExplorer}
        onPress={handleOpenExplorer}
        className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <XCircle size={16} color={BRAND_RED} />
          <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
            Failed
          </Text>
        </View>
        <Text
          className="text-sm text-light-matte-black/80 mt-1.5"
          style={{ color: MATTE_BLACK }}
          numberOfLines={0}
        >
          {record.description}
        </Text>
        {record.error ? (
          <Text
            // Verbatim error rendering per §7 "Honesty". No softening,
            // no mapping to a friendlier string, no fallback copy.
            className="text-xs text-light-primary-red mt-1.5"
            numberOfLines={0}
            selectable
          >
            {record.error}
          </Text>
        ) : null}
        {record.tx_hash ? (
          <View className="flex-row items-center gap-2 mt-2">
            <Text
              className="text-[11px] text-gray-500 flex-1"
              numberOfLines={1}
            >
              {truncateHash(record.tx_hash)}
            </Text>
            {canOpenExplorer ? (
              <ExternalLink size={12} color={MUTED_GRAY} />
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  }

  // --- "submitted" (default) ----------------------------------------
  const a11yLabel = `Submitting transaction to the network. ${
    record.description
  }.${canOpenExplorer ? " Double-tap to open block explorer." : ""}`;
  return (
    <Pressable
      accessible
      accessibilityRole={canOpenExplorer ? "button" : "summary"}
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion="polite"
      disabled={!canOpenExplorer}
      onPress={handleOpenExplorer}
      className="my-1.5 rounded-2xl border border-light-primary-red/30 bg-light-primary-red/5 px-3.5 py-3 active:opacity-80"
    >
      <View className="flex-row items-center gap-2">
        <ActivityIndicator size="small" color={BRAND_RED} />
        <Text className="text-xs font-bold uppercase tracking-wide text-light-primary-red">
          Submitting to the network…
        </Text>
      </View>
      <Text
        className="text-sm text-light-matte-black/80 mt-1.5"
        style={{ color: MATTE_BLACK }}
        numberOfLines={0}
      >
        {record.description}
      </Text>
      <View className="flex-row items-center gap-2 mt-2">
        <Text className="text-[11px] text-gray-500 flex-1" numberOfLines={1}>
          {truncateHash(record.tx_hash)}
        </Text>
        <TouchableOpacity
          onPress={handleCopyHash}
          accessibilityRole="button"
          accessibilityLabel="Copy transaction hash"
          hitSlop={8}
        >
          <Copy size={12} color={MUTED_GRAY} />
        </TouchableOpacity>
        {canOpenExplorer ? <ExternalLink size={12} color={MUTED_GRAY} /> : null}
      </View>
    </Pressable>
  );
};

export default PendingTxCard;

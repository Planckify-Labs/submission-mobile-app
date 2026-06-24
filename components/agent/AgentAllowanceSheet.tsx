/**
 * `AgentAllowanceSheet` — bottom sheet that lets the user authorize a
 * bounded ERC-7710 onchain spending allowance for the AI agent (spec
 * Phase 2 §6.1). Two stages:
 *
 *   1. "pick"   — choose which ERC-20 the allowance applies to. The token
 *                 catalogue is **API-driven** via `useTokens()` (cached
 *                 backend list), filtered to the active chain's ERC-20s.
 *   2. "amount" — enter a token-denominated cap + pick a duration.
 *
 * The screen handles biometric gating, delegation building/signing, and
 * persistence; this sheet only collects intent.
 *
 * Shell: the shared `BaseModal` bottom-sheet (slide-in + fade backdrop,
 * drag-to-close, keyboard-aware grow) so the smart-account flows share the
 * app-wide sheet feel. The parent renders this only while open; an internal
 * `open` flag runs BaseModal's slide-out, then `onClosed` calls the parent's
 * `onClose` (which unmounts us).
 */

import { ArrowLeft, Search, ShieldCheck } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BaseModal } from "@/components/common/BaseModal";
import OptimizedImage from "@/components/common/OptimizedImage";
import { useTokens } from "@/hooks/queries/useTokens";
import { useBlockchainsWithStorage } from "@/hooks/useBlockchainsWithStorage";
import type { AllowanceLifetime } from "@/services/agentDelegationMapping";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SelectedAllowanceToken {
  contractAddress: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
  logoUrl?: string;
}

interface DurationOption {
  label: string;
  build: () => AllowanceLifetime;
}

const DURATION_OPTIONS: DurationOption[] = [
  {
    label: "1 day",
    build: () => ({ type: "timed", expiresAtMs: Date.now() + DAY_MS }),
  },
  {
    label: "7 days",
    build: () => ({ type: "timed", expiresAtMs: Date.now() + 7 * DAY_MS }),
  },
  {
    label: "30 days",
    build: () => ({ type: "timed", expiresAtMs: Date.now() + 30 * DAY_MS }),
  },
  { label: "Until revoked", build: () => ({ type: "permanent" }) },
];

interface AgentAllowanceSheetProps {
  /** Active EVM chain id — used to filter the API token list. */
  chainId: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (args: {
    token: SelectedAllowanceToken;
    amountText: string;
    lifetime: AllowanceLifetime;
  }) => void;
}

function TokenAvatar({
  logoUrl,
  symbol,
  size = 36,
}: {
  logoUrl?: string;
  symbol: string;
  size?: number;
}) {
  const radius = size / 2;
  if (logoUrl) {
    return (
      <OptimizedImage
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        containerStyle={{
          width: size,
          height: size,
          borderRadius: radius,
          marginRight: 12,
        }}
        contentFit="cover"
        alt={`${symbol} logo`}
      />
    );
  }
  return (
    <View
      className="items-center justify-center mr-3 bg-light-primary-red/10"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Text
        className="text-light-primary-red font-bold"
        style={{ fontSize: Math.max(10, size * 0.35) }}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

export default function AgentAllowanceSheet({
  chainId,
  busy = false,
  onClose,
  onConfirm,
}: AgentAllowanceSheetProps) {
  // The parent mounts this sheet only while open. Drive BaseModal with an
  // internal `open` flag so a close request animates out first, then bridges
  // to the parent's `onClose` (which unmounts us) via `onClosed`.
  const [open, setOpen] = useState(true);

  const requestClose = useCallback(() => {
    if (busy) return;
    setOpen(false);
  }, [busy]);

  const [stage, setStage] = useState<"pick" | "amount">("pick");
  const [selected, setSelected] = useState<SelectedAllowanceToken | null>(null);
  const [search, setSearch] = useState("");
  const [amountText, setAmountText] = useState("");
  const [durationIndex, setDurationIndex] = useState(1); // default 7 days

  // API-driven token catalogue + the chainId↔blockchainId map (the
  // registry keys tokens by UUID, not chain id).
  const { data: blockchains } = useBlockchainsWithStorage();

  const blockchainId = useMemo(
    () => blockchains?.find((b) => b.chainId === chainId)?.id ?? null,
    [blockchains, chainId],
  );

  // Scope the catalogue to the active backend chain — same pattern as the
  // send.tsx token picker. Passing `blockchainId` (instead of an unscoped
  // `useTokens()` + a loose `blockchainId ? … : true` filter) prevents the
  // cross-chain bleed that hid the chain's real USDC behind aUSDC/IDRX.
  const { data: rawTokenList = [], isLoading: tokensLoading } = useTokens(
    blockchainId ? { blockchainId } : undefined,
  );

  // ERC-7710 transfer-amount scopes need a real ERC-20 contract — drop
  // native + inactive entries, strictly scope to the active chain
  // (never fall back to "all chains"), then search.
  const tokens = useMemo<SelectedAllowanceToken[]>(() => {
    if (!blockchainId) return [];
    const q = search.trim().toLowerCase();
    return rawTokenList
      .filter(
        (t) =>
          t.blockchainId === blockchainId &&
          !t.isNativeCurrency &&
          t.isActive !== false &&
          (t.contractAddress?.length ?? 0) > 0,
      )
      .filter(
        (t) =>
          !q ||
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q),
      )
      .map((t) => ({
        contractAddress: (
          t.contractAddress as string
        ).toLowerCase() as `0x${string}`,
        decimals: t.decimals,
        symbol: t.symbol,
        name: t.name,
        logoUrl: t.logoUrl || undefined,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [rawTokenList, blockchainId, search]);

  const duration = DURATION_OPTIONS[durationIndex];
  const amountValid = /^\d*\.?\d+$/.test(amountText.trim());
  const canAuthorize = !!selected && amountValid && !busy;

  const summary =
    selected && amountValid
      ? duration.label === "Until revoked"
        ? `The agent may spend up to ${amountText} ${selected.symbol} until you revoke it.`
        : `The agent may spend up to ${amountText} ${selected.symbol} over the next ${duration.label}.`
      : "Enter a spending cap and pick how long it stays valid.";

  return (
    <BaseModal
      visible={open}
      onClose={requestClose}
      onClosed={onClose}
      maxHeight="85%"
      borderRadius={32}
      enablePanToClose={!busy}
      enableBackdropClose={!busy}
      closeButtonDisabled={busy}
    >
      <View className="px-6 pb-1">
        <View className="flex-row items-center mb-4 pr-10">
          {stage === "amount" && (
            <TouchableOpacity
              onPress={() => setStage("pick")}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Back to token selection"
              className="mr-2 bg-light-main-container p-2 rounded-full"
            >
              <ArrowLeft size={16} color="#20222c" />
            </TouchableOpacity>
          )}
          <ShieldCheck size={22} color="#c71c4b" />
          <Text className="text-light-matte-black text-xl font-bold ml-2">
            {stage === "pick" ? "Choose a token" : "Spending Delegation"}
          </Text>
        </View>
      </View>

      {stage === "pick" ? (
        <View className="px-6">
          <View className="flex-row items-center bg-white rounded-2xl px-3 mb-3">
            <Search size={16} color="#9aa0ab" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search tokens"
              placeholderTextColor="#9aa0ab"
              autoCapitalize="characters"
              autoCorrect={false}
              className="flex-1 py-3 px-2 text-light-matte-black"
            />
          </View>

          {tokensLoading && tokens.length === 0 ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="small" color="#c71c4b" />
              <Text className="text-light-matte-black/50 text-xs mt-2">
                Loading tokens…
              </Text>
            </View>
          ) : tokens.length === 0 ? (
            <View className="py-10 items-center">
              <Text className="text-light-matte-black/60 text-sm">
                No tokens available on this network.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 360 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {tokens.map((t, index) => (
                <TouchableOpacity
                  key={t.contractAddress}
                  onPress={() => {
                    setSelected(t);
                    setStage("amount");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${t.symbol}`}
                  className={`flex-row items-center py-3 ${index > 0 ? "border-t border-light-matte-black/5" : ""}`}
                >
                  <TokenAvatar logoUrl={t.logoUrl} symbol={t.symbol} />
                  <View className="flex-1">
                    <Text className="text-light-matte-black font-semibold">
                      {t.symbol}
                    </Text>
                    <Text
                      className="text-light-matte-black/50 text-xs mt-0.5"
                      numberOfLines={1}
                    >
                      {t.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        selected && (
          <View className="px-6">
            <View className="flex-row items-center bg-white rounded-2xl p-3 mb-4">
              <TokenAvatar
                logoUrl={selected.logoUrl}
                symbol={selected.symbol}
              />
              <View className="flex-1">
                <Text className="text-light-matte-black font-semibold">
                  {selected.symbol}
                </Text>
                <Text
                  className="text-light-matte-black/50 text-xs mt-0.5"
                  numberOfLines={1}
                >
                  {selected.name}
                </Text>
              </View>
            </View>

            <Text className="text-light-matte-black/50 text-xs uppercase tracking-wide mb-2">
              Spending cap
            </Text>
            <View className="flex-row items-center bg-white rounded-2xl px-4 mb-5">
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0.0"
                placeholderTextColor="#9aa0ab"
                keyboardType="decimal-pad"
                className="flex-1 py-3 text-light-matte-black text-lg font-semibold"
              />
              <Text className="text-light-matte-black/50 font-semibold ml-2">
                {selected.symbol}
              </Text>
            </View>

            <Text className="text-light-matte-black/50 text-xs uppercase tracking-wide mb-2">
              Valid for
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {DURATION_OPTIONS.map((opt, i) => {
                const active = i === durationIndex;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    onPress={() => setDurationIndex(i)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    className={`px-4 py-2.5 rounded-2xl ${active ? "bg-light-primary-red" : "bg-white"}`}
                  >
                    <Text
                      className={`font-semibold text-sm ${active ? "text-white" : "text-light-matte-black"}`}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="bg-light-main-container/60 p-4 rounded-2xl mb-5">
              <Text className="text-light-matte-black/60 text-xs leading-4 text-center">
                {summary}
              </Text>
            </View>

            <Text className="text-light-matte-black/50 text-[11px] leading-4 mb-4 text-center">
              This signs a cryptographic ERC-7710 delegation. The cap is
              enforced onchain — the agent can never exceed it.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canAuthorize}
              className={`py-4 rounded-full items-center justify-center shadow-md flex-row ${canAuthorize ? "bg-light-primary-red" : "bg-light-primary-red/40"}`}
              onPress={() =>
                selected &&
                onConfirm({
                  token: selected,
                  amountText: amountText.trim(),
                  lifetime: duration.build(),
                })
              }
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  Authorize Delegation
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )
      )}

      {/* Breathing room above the safe-area inset BaseModal already pads. */}
      <View style={{ height: 24 }} />
    </BaseModal>
  );
}

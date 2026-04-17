/**
 * `ConnectSheet` — unified approval UI for dApp `connect` intents across
 * every registered chain namespace (`eip155`, `solana`, and any future
 * kit such as `sui`).
 *
 * Pluggability contract:
 *   - The sheet reads `intent.namespace` and resolves the relevant kit
 *     from `walletKitRegistry`. It never branches on the namespace string.
 *   - Per-chain presentation (chip colour, chip sub-label, biometric gate)
 *     is owned by the kit itself via the optional hooks:
 *       - `brandColor`
 *       - `formatConnectChipLabel(payload)`
 *       - `requireBiometricForConnect`
 *     Chains that want different UX register different values; chains
 *     without a kit fall through to neutral defaults.
 *   - Wallet filtering matches `TWallet.namespace === intent.namespace`,
 *     so a Solana-dApp connect can only select Solana wallets, EVM can
 *     only select EVM wallets, Sui only Sui, etc. No edit needed here.
 */

import {
  Check,
  Globe,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet as WalletIcon,
  X,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { TWallet } from "@/constants/types/walletTypes";
import { useWallet } from "@/hooks/useWallet";
import type {
  ApprovalDecision,
  ApprovalIntent,
} from "@/services/bridge/approval";
import { getDappBridge } from "@/services/bridge/DappBridge";
import { InspectorRegistry } from "@/services/bridge/inspector";
import { walletKitRegistry } from "@/services/walletKit/registry";
import { truncateAddress } from "@/utils/walletUtils";
import { RiskBanner } from "./RiskBanner";
import { PrimaryActions, SheetModal } from "./SheetModal";
import { useBiometricApproval } from "./useBiometricApproval";

interface Props {
  intent: ApprovalIntent;
  onDecision: (d: ApprovalDecision) => void;
}

/** Neutral grey used when a kit doesn't advertise a `brandColor`. */
const DEFAULT_BRAND_COLOR = "#6b7280";

function namespaceFallback(ns: TWallet["namespace"]): string {
  if (ns === "eip155") return "Ethereum";
  return ns.charAt(0).toUpperCase() + ns.slice(1);
}

export function ConnectSheet({
  intent,
  onDecision,
}: Props): React.ReactElement {
  const { wallets, activeWalletIndex } = useWallet();

  const namespace = intent.namespace as TWallet["namespace"];

  // `walletKitRegistry.get` throws for unregistered namespaces (by design —
  // see `registry.ts`). The approval pipeline only surfaces intents for
  // registered kits, so a miss here indicates a bridge-boot ordering bug
  // rather than a user-reachable state. Fall through to `undefined` so
  // the sheet still renders a neutral chip instead of crashing.
  const kit = useMemo(() => {
    try {
      return walletKitRegistry.get(namespace);
    } catch {
      return undefined;
    }
  }, [namespace]);

  const chipLabel =
    kit?.formatConnectChipLabel?.(intent.payload) ??
    kit?.displayName ??
    namespaceFallback(namespace);
  const brandColor = kit?.brandColor ?? DEFAULT_BRAND_COLOR;
  const chipDisplayName = kit?.displayName ?? namespaceFallback(namespace);

  // Only wallets whose namespace matches the requested chain family are
  // connectable. A viem dApp cannot accept a base58 Solana address, a
  // Solana dApp cannot accept a 0x EVM address, and the same reasoning
  // extends to any future namespace.
  const chainWallets = useMemo(
    () =>
      wallets
        .map((w, i) => ({ wallet: w, index: i }))
        .filter((w) => w.wallet.namespace === namespace),
    [wallets, namespace],
  );

  const defaultIndex = chainWallets.find((w) => w.index === activeWalletIndex)
    ? activeWalletIndex
    : (chainWallets[0]?.index ?? activeWalletIndex);

  const [selected, setSelected] = useState<number>(defaultIndex);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWallets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chainWallets;
    return chainWallets.filter(({ wallet }) => {
      if ((wallet.name ?? "").toLowerCase().includes(q)) return true;
      if (wallet.address.toLowerCase().includes(q)) return true;
      if ((wallet.type ?? "").toLowerCase().includes(q)) return true;
      if (chipDisplayName.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [chainWallets, searchQuery, chipDisplayName]);

  const isSecure = intent.origin.url.startsWith("https://");
  const host = (() => {
    try {
      return new URL(intent.origin.url).hostname;
    } catch {
      return intent.origin.url;
    }
  })();

  const onDemandInspectors = InspectorRegistry.list("on-demand").filter(
    (i) => !i.namespaces || i.namespaces.includes(intent.namespace),
  );
  const canAskAgent = onDemandInspectors.some((i) => i.name === "agent");

  const reject = useCallback(() => {
    onDecision({ id: intent.id, outcome: "reject" });
  }, [intent.id, onDecision]);

  const approve = useCallback(() => {
    onDecision({
      id: intent.id,
      outcome: "approve",
      data: { walletIndex: selected },
    });
  }, [intent.id, onDecision, selected]);

  // Biometric gating is kit-controlled; EVM kits ship without it, Solana
  // with it. The hook's return values are inert when the kit opts out, so
  // the ungated path just maps `gatedApprove` → `approve` below.
  const biometric = useBiometricApproval(
    `Approve connect to ${host}`,
    approve,
  );
  const requireBiometric = kit?.requireBiometricForConnect === true;
  const onApprove = requireBiometric
    ? () => {
        void biometric.gatedApprove();
      }
    : approve;
  const pending = requireBiometric ? biometric.pending : false;
  const biometricError = requireBiometric ? biometric.error : null;

  return (
    <SheetModal onDismiss={reject}>
      <View className="flex-row items-center justify-between px-4 pt-3 pb-3">
        <View className="flex-row items-center gap-2 flex-1 pr-3">
          <View className="w-10 h-10 bg-light-primary-red/10 rounded-full items-center justify-center">
            <WalletIcon size={18} color="#c71c4b" />
          </View>
          <View className="flex-1">
            <Text
              className="text-light-matte-black text-lg font-bold"
              numberOfLines={1}
            >
              Connect Wallet
            </Text>
            <View className="flex-row items-center">
              <Globe size={11} color={isSecure ? "#059669" : "#ea580c"} />
              <Text
                className="ml-1 text-light-matte-black/60 text-xs flex-1"
                numberOfLines={1}
              >
                {host}
              </Text>
              {isSecure ? (
                <ShieldCheck size={11} color="#059669" />
              ) : (
                <Text className="text-xs text-orange-600">insecure</Text>
              )}
            </View>
          </View>
        </View>
        <Pressable
          onPress={reject}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="w-8 h-8 rounded-full bg-light-matte-black/10 items-center justify-center"
        >
          <X size={18} color="#20222c" />
        </Pressable>
      </View>

      <View className="px-4 mb-3">
        <View
          className="px-2 py-0.5 self-start rounded-full"
          style={{ backgroundColor: `${brandColor}1A` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: brandColor }}
          >
            {chipLabel}
          </Text>
        </View>
      </View>

      <View className="px-4">
        <RiskBanner annotations={intent.annotations} />
        {canAskAgent && (
          <TouchableOpacity
            onPress={() => {
              getDappBridge()?.runOnDemandInspector("agent", intent.id);
            }}
            className="flex-row items-center self-start bg-purple-50 border border-purple-200 rounded-full px-3 py-1.5 mb-3"
          >
            <Sparkles size={12} color="#7c3aed" />
            <Text className="ml-1 text-xs text-purple-700 font-medium">
              Ask Takumi AI to review
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {chainWallets.length > 1 && (
        <View className="px-4 mb-3">
          <View className="bg-light rounded-2xl flex-row items-center px-4">
            <Search size={18} color="#20222c" />
            <TextInput
              className="flex-1 py-3 px-2 text-light-matte-black"
              placeholder="Search by name or address…"
              placeholderTextColor="#20222c80"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <X size={16} color="#20222c" />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {chainWallets.length === 0 ? (
          <View className="p-4 rounded-2xl bg-light">
            <Text className="text-sm text-light-matte-black/70">
              No {chipDisplayName} wallet found. Add one to continue.
            </Text>
          </View>
        ) : filteredWallets.length === 0 ? (
          <View className="items-center py-6">
            <Text className="text-light-matte-black/60 text-center">
              {`No wallets match "${searchQuery}"`}
            </Text>
          </View>
        ) : (
          filteredWallets.map(({ wallet, index }) => {
            const isSelected = selected === index;
            return (
              <Pressable
                key={wallet.address}
                onPress={() => setSelected(index)}
                className={`flex-row items-center p-4 mb-2 rounded-xl ${
                  isSelected ? "bg-light-primary-red/10" : "bg-light"
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                    isSelected
                      ? "bg-light-primary-red"
                      : "bg-light-primary-red/10"
                  }`}
                >
                  <WalletIcon
                    size={18}
                    color={isSelected ? "#ffffff" : "#c71c4b"}
                  />
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text
                      className="font-bold text-light-matte-black"
                      numberOfLines={1}
                    >
                      {wallet.name || `Wallet ${index + 1}`}
                    </Text>
                    <View
                      className="ml-2 px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${brandColor}1A` }}
                    >
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: brandColor }}
                      >
                        {chipDisplayName}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm mt-0.5 text-light-matte-black/70">
                    {truncateAddress({
                      address: wallet.address,
                      preset: "medium",
                    })}
                  </Text>
                </View>
                {isSelected && (
                  <View className="w-6 h-6 rounded-full bg-light-primary-red items-center justify-center">
                    <Check size={14} color="#ffffff" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View className="px-4 pb-1">
        <View className="bg-light rounded-2xl p-3">
          <Text className="text-light-matte-black/60 text-xs text-center">
            Only connect to websites you trust. Takumi will never ask for your
            private keys or seed phrase.
          </Text>
        </View>
      </View>

      {biometricError && (
        <Text
          className="text-xs text-red-600 px-4 mt-2"
          accessibilityLabel="biometric-error"
        >
          {biometricError}
        </Text>
      )}

      <PrimaryActions
        approveLabel={pending ? "Authenticating…" : "Connect"}
        onApprove={onApprove}
        onReject={reject}
        loading={pending}
        disabled={chainWallets.length === 0}
      />
    </SheetModal>
  );
}

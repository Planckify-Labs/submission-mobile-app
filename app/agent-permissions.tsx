/**
 * Agent Permissions settings screen.
 *
 * Spec: `AGENT_PROTOCOL.md` §6 "App Settings: Managing Active Grants"
 *       and §6 "Default Permission Mode".
 *
 * Lets the user inspect and revoke the permission grants that the AI
 * agent is currently allowed to act on, switch between the three
 * default-permission modes ("Always ask", "Agent decides", "Full auto"),
 * and switch between connected wallets (grants are wallet-scoped).
 *
 * All non-UI logic lives in `services/agentPermissionsHelpers.ts` and is
 * unit-tested from there; this file is deliberately a thin renderer on
 * top of those helpers and the `PermissionGrantStore` public API.
 */

import { router } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Shield,
  ShieldOff,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useWallet } from "@/hooks/useWallet";
import {
  computeCurrentMode,
  type DefaultPermissionMode,
  formatLifetimeLabel,
  formatScopeLabel,
  listRenderableGrants,
} from "@/services/agentPermissionsHelpers";
import {
  type PermissionGrant,
  PermissionGrantStore,
} from "@/services/permissionGrantStore";

// --- Mode metadata ---------------------------------------------------------

interface ModeMeta {
  id: DefaultPermissionMode;
  label: string;
  subtitle: string;
  accessibilityHint: string;
}

const MODES: ModeMeta[] = [
  {
    id: "always_ask",
    label: "Always ask",
    subtitle: "Every action needs your explicit tap.",
    accessibilityHint: "Every agent action will require explicit confirmation.",
  },
  {
    id: "agent_decides",
    label: "Agent decides",
    subtitle:
      "Agent uses wallet policy — asks for writes, previews simulations.",
    accessibilityHint:
      "The wallet approval policy controls when to prompt you.",
  },
  {
    id: "full_auto",
    label: "Full auto",
    subtitle: "Agent executes writes silently until revoked.",
    accessibilityHint:
      "The agent can sign and submit transactions without asking.",
  },
];

// --- Store cache per wallet address ---------------------------------------

/**
 * Cache of `PermissionGrantStore` instances keyed by lowercased wallet
 * address. Re-used across renders so switching the wallet picker doesn't
 * spin up a fresh store (and so the screen observes the same instance
 * that the agent dispatcher will eventually use).
 */
const storeCache = new Map<string, PermissionGrantStore>();

function getStoreFor(address: `0x${string}`): PermissionGrantStore {
  const key = address.toLowerCase();
  let store = storeCache.get(key);
  if (!store) {
    store = new PermissionGrantStore(address);
    storeCache.set(key, store);
  }
  return store;
}

// --- Helpers ---------------------------------------------------------------

function grantKey(grant: PermissionGrant): string {
  const scopeKey =
    grant.scope.kind === "global"
      ? "global"
      : `${grant.scope.kind}:${(grant.scope as { key: string }).key}`;
  return `${scopeKey}|${grant.lifetime.type}`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// --- Screen ----------------------------------------------------------------

export default function AgentPermissionsScreen() {
  const { wallets, activeWallet, activeWalletIndex, setActiveWallet } =
    useWallet();
  const { bottom } = useSafeAreaInsets();

  const [selectedWalletIndex, setSelectedWalletIndex] =
    useState<number>(activeWalletIndex);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [, forceRender] = useState(0);

  // If the tab-level active wallet changes, follow it.
  useEffect(() => {
    setSelectedWalletIndex(activeWalletIndex);
  }, [activeWalletIndex]);

  const selectedWallet = wallets[selectedWalletIndex] ?? activeWallet;
  const address = (selectedWallet?.address ?? "") as `0x${string}`;

  const store = useMemo(() => {
    if (!address) return null;
    return getStoreFor(address);
  }, [address]);

  // Prune expired timed grants on mount / wallet change.
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    store.whenLoaded().then(() => {
      if (cancelled) return;
      store.prune();
      forceRender((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const grants = useMemo(() => {
    if (!store || !address) return [];
    return listRenderableGrants(store.list(address));
  }, [store, address]);

  const currentMode = useMemo(() => computeCurrentMode(grants), [grants]);

  const refresh = useCallback(() => {
    forceRender((n) => n + 1);
  }, []);

  // --- Mutations ----------------------------------------------------------

  const handleRevoke = useCallback(
    (grant: PermissionGrant) => {
      if (!store) return;
      const label = formatScopeLabel(grant.scope);
      Alert.alert(
        "Revoke permission",
        `Revoke the "${label}" grant? The agent will need to ask again on its next matching action.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: () => {
              store.remove(grant);
              refresh();
            },
          },
        ],
      );
    },
    [store, refresh],
  );

  const handleRevokeAll = useCallback(() => {
    if (!store || !address) return;
    Alert.alert(
      "Revoke all permissions",
      "This removes every active grant for this wallet. The agent will ask for approval on every write until you grant new permissions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke all",
          style: "destructive",
          onPress: () => {
            store.revokeAll(address);
            refresh();
          },
        },
      ],
    );
  }, [store, address, refresh]);

  const applyMode = useCallback(
    (mode: DefaultPermissionMode) => {
      if (!store || !address) return;
      const now = Date.now();
      if (mode === "always_ask") {
        store.add({
          scope: { kind: "global" },
          lifetime: { type: "always_ask" },
          wallet_address: address,
          granted_at: now,
        });
      } else if (mode === "agent_decides") {
        store.revokeAll(address);
      } else {
        // full_auto
        store.add({
          scope: { kind: "global" },
          lifetime: { type: "permanent" },
          wallet_address: address,
          granted_at: now,
        });
      }
      refresh();
    },
    [store, address, refresh],
  );

  const handleSelectMode = useCallback(
    (mode: DefaultPermissionMode) => {
      if (mode === currentMode) return;
      if (mode === "full_auto") {
        Alert.alert(
          "Enable Full auto?",
          "Full auto lets the agent sign and submit transactions without asking — including sending funds out of this wallet. Only enable this if you completely trust the agent's instructions. You can switch back at any time.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Enable Full auto",
              style: "destructive",
              onPress: () => applyMode(mode),
            },
          ],
        );
        return;
      }
      if (mode === "always_ask") {
        Alert.alert(
          "Switch to Always ask?",
          "Every agent action will require your explicit confirmation. Existing grants stay on file but will be overridden.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Switch", onPress: () => applyMode(mode) },
          ],
        );
        return;
      }
      // agent_decides
      Alert.alert(
        "Switch to Agent decides?",
        "This clears every active grant for this wallet. The agent will fall back to your wallet's approval policy.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear and switch",
            style: "destructive",
            onPress: () => applyMode(mode),
          },
        ],
      );
    },
    [currentMode, applyMode],
  );

  const handlePickWallet = useCallback(
    (index: number) => {
      setSelectedWalletIndex(index);
      setShowWalletPicker(false);
      // Also update the app-wide active wallet so the rest of the app
      // stays in sync with what the user is inspecting.
      setActiveWallet(index);
    },
    [setActiveWallet],
  );

  const nowMs = Date.now();

  // --- Render -------------------------------------------------------------

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView
        className="flex-1 bg-light-main-container"
        edges={["top"]}
        style={{ paddingBottom: bottom > 0 ? bottom : 0 }}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              className="w-9 h-9 rounded-xl bg-light items-center justify-center shadow-sm"
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={18} color="#c71c4b" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-light-matte-black text-2xl font-bold tracking-tight">
                Agent Permissions
              </Text>
              <Text className="text-light-matte-black/50 text-xs mt-0.5">
                What the AI agent is allowed to do on your behalf.
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Wallet picker */}
          <View className="mx-4 mb-4">
            <Text className="text-light-matte-black/50 text-xs uppercase tracking-wide mb-2 ml-1">
              Wallet
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (wallets.length > 1) setShowWalletPicker((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Active wallet: ${selectedWallet?.name ?? ""}, ${shortAddress(address)}`}
              className="bg-light rounded-2xl px-4 py-3 flex-row items-center justify-between"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              <View className="flex-1">
                <Text
                  className="text-light-matte-black font-semibold text-base"
                  numberOfLines={1}
                >
                  {selectedWallet?.name || "Wallet"}
                </Text>
                <Text className="text-light-matte-black/50 text-xs mt-0.5">
                  {address ? shortAddress(address) : "No address"}
                </Text>
              </View>
              {wallets.length > 1 && <ChevronDown size={18} color="#c71c4b" />}
            </TouchableOpacity>

            {showWalletPicker && wallets.length > 1 && (
              <View className="bg-light rounded-2xl mt-2 overflow-hidden">
                {wallets.map((w, index) => {
                  const isSelected = index === selectedWalletIndex;
                  return (
                    <TouchableOpacity
                      key={w.address || `wallet-${index}`}
                      onPress={() => handlePickWallet(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to wallet ${w.name}`}
                      className={`px-4 py-3 flex-row items-center justify-between ${index > 0 ? "border-t border-light-matte-black/5" : ""}`}
                    >
                      <View className="flex-1">
                        <Text
                          className="text-light-matte-black font-medium"
                          numberOfLines={1}
                        >
                          {w.name}
                        </Text>
                        <Text className="text-light-matte-black/50 text-xs mt-0.5">
                          {shortAddress(w.address)}
                        </Text>
                      </View>
                      {isSelected && (
                        <View className="w-2.5 h-2.5 rounded-full bg-light-primary-red" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Active grants list */}
          <View className="mx-4 mb-6">
            <Text className="text-light-matte-black/50 text-xs uppercase tracking-wide mb-2 ml-1">
              Active grants
            </Text>
            <View
              className="bg-light rounded-2xl overflow-hidden"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              {grants.length === 0 ? (
                <View className="px-4 py-8 items-center">
                  <Shield size={28} color="#c71c4b" />
                  <Text className="text-light-matte-black font-semibold mt-3">
                    No active grants
                  </Text>
                  <Text className="text-light-matte-black/50 text-xs text-center mt-1 max-w-[260px]">
                    The agent will ask for approval before running any write
                    actions on this wallet.
                  </Text>
                </View>
              ) : (
                grants.map((grant, index) => {
                  const scopeLabel = formatScopeLabel(grant.scope);
                  const lifetime = formatLifetimeLabel(
                    grant.lifetime,
                    nowMs,
                    grant.granted_at,
                  );
                  const fullDescription = `${scopeLabel}, ${lifetime.primary}${lifetime.secondary ? `, ${lifetime.secondary}` : ""}`;
                  return (
                    <View
                      key={grantKey(grant)}
                      accessible
                      accessibilityLabel={fullDescription}
                      className={`px-4 py-3 flex-row items-center justify-between ${index > 0 ? "border-t border-light-matte-black/5" : ""}`}
                    >
                      <View className="flex-1 pr-3">
                        <Text
                          className="text-light-matte-black font-semibold"
                          numberOfLines={1}
                        >
                          {scopeLabel}
                        </Text>
                        <Text className="text-light-matte-black/60 text-xs mt-0.5">
                          {lifetime.primary}
                          {lifetime.secondary ? ` • ${lifetime.secondary}` : ""}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRevoke(grant)}
                        accessibilityRole="button"
                        accessibilityLabel={`Revoke ${scopeLabel}`}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        className="bg-light-primary-red/10 px-3 py-1.5 rounded-xl"
                      >
                        <Text className="text-light-primary-red text-xs font-semibold">
                          Revoke
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Default mode selector */}
          <View className="mx-4 mb-6">
            <Text className="text-light-matte-black/50 text-xs uppercase tracking-wide mb-2 ml-1">
              Default mode
            </Text>
            <View
              className="bg-light rounded-2xl overflow-hidden"
              accessibilityRole="radiogroup"
              accessibilityLabel="Default permission mode"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 6,
                elevation: 1,
              }}
            >
              {MODES.map((mode, index) => {
                const isSelected = mode.id === currentMode;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    onPress={() => handleSelectMode(mode.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={mode.label}
                    accessibilityHint={mode.accessibilityHint}
                    className={`px-4 py-3 flex-row items-start ${index > 0 ? "border-t border-light-matte-black/5" : ""}`}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 mr-3 mt-0.5 items-center justify-center ${isSelected ? "border-light-primary-red" : "border-light-matte-black/30"}`}
                    >
                      {isSelected && (
                        <View className="w-2.5 h-2.5 rounded-full bg-light-primary-red" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-light-matte-black font-semibold">
                        {mode.label}
                      </Text>
                      <Text className="text-light-matte-black/60 text-xs mt-0.5">
                        {mode.subtitle}
                      </Text>
                    </View>
                    {mode.id === "full_auto" && (
                      <AlertTriangle
                        size={16}
                        color="#c71c4b"
                        style={{ marginLeft: 8, marginTop: 2 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {currentMode === "full_auto" && (
              <View className="flex-row items-start mt-3 px-1">
                <AlertTriangle size={14} color="#c71c4b" />
                <Text className="text-light-primary-red text-xs ml-2 flex-1 leading-4">
                  Full auto is enabled. The agent can move funds out of this
                  wallet without asking.
                </Text>
              </View>
            )}
          </View>

          {/* Revoke all */}
          {grants.length > 0 && (
            <View className="mx-4 mb-4">
              <TouchableOpacity
                onPress={handleRevokeAll}
                accessibilityRole="button"
                accessibilityLabel="Revoke all permissions for this wallet"
                className="bg-light-primary-red/10 border border-light-primary-red/30 rounded-2xl px-4 py-3 flex-row items-center justify-center"
              >
                <ShieldOff size={16} color="#c71c4b" />
                <Text className="text-light-primary-red font-bold ml-2">
                  Revoke all permissions
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Live updates note */}
          <View className="mx-4 mt-2 flex-row items-start">
            <Trash2
              size={12}
              color="#666"
              style={{ marginTop: 2, opacity: 0.5 }}
            />
            <Text className="text-light-matte-black/50 text-xs ml-2 flex-1 leading-4">
              Changes apply to new actions. Active prompts are unaffected.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

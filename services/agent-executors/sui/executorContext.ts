/**
 * Shared Sui executor context (spec §8.4) — the small helpers the Sui
 * agent executors need: the active Sui chain, the Sui WalletKit, and the
 * token registry for symbol → coinType resolution.
 *
 * Mirrors the private helpers in `wallet/sui.ts` (deliberately a separate
 * module so that file stays untouched). `loadSuiTokens` reuses the exact
 * cache path `getSuiWalletTokens` uses (per-blockchain MMKV cache +
 * `tokenApi.searchTokens`).
 */

import type { TToken } from "@/api/types/token";
import type {
  ChainConfig,
  SuiChainConfig,
} from "@/constants/configs/chainConfig";
import { resolveNamespace } from "@/hooks/useWallet.helpers";
import { storage } from "@/lib/storage/mmkv";
import { walletKitRegistry } from "@/services/walletKit/registry";
import {
  type ExecutorContext,
  ExecutorError,
  ExecutorErrorCode,
} from "../types";

const SUI_NAMESPACE = "sui" as const;
const SUI_TOKENS_STALE_MS = 5 * 60 * 1000;

/** Active Sui chain from the MMKV slot `useWallet` writes (mirrors wallet/sui.ts). */
export function getActiveSuiChain(): SuiChainConfig {
  const raw = storage.getString("active_chain");
  if (!raw) {
    throw new ExecutorError(
      ExecutorErrorCode.UnsupportedChain,
      "no_active_chain",
    );
  }
  const parsed = JSON.parse(raw) as ChainConfig;
  if (parsed.namespace !== SUI_NAMESPACE) {
    throw new ExecutorError(
      ExecutorErrorCode.UnsupportedChain,
      "active_chain_is_not_sui",
    );
  }
  return parsed;
}

export function getSuiKit() {
  if (!walletKitRegistry.has(SUI_NAMESPACE)) {
    throw new ExecutorError(
      ExecutorErrorCode.NotImplemented,
      "sui_kit_not_registered",
    );
  }
  return walletKitRegistry.get(SUI_NAMESPACE);
}

/**
 * Load the active Sui network's token list — same per-blockchain MMKV
 * cache + `tokenApi.searchTokens` path as `getSuiWalletTokens`. Returns an
 * empty list if the registry has no matching Sui blockchain row (the
 * compiler still resolves native SUI from its own constant).
 */
export async function loadSuiTokens(
  context: ExecutorContext,
  chain: SuiChainConfig,
): Promise<TToken[]> {
  const isTestnet = chain.network !== "mainnet";
  const suiBlockchain = context.blockchains.find(
    (b) =>
      resolveNamespace(b) === SUI_NAMESPACE &&
      b.isActive &&
      b.isTestnet === isTestnet,
  );
  if (!suiBlockchain) return [];

  const cacheKey = `cached_sui_tokens_${suiBlockchain.id}`;
  const tsKey = `cached_sui_tokens_ts_${suiBlockchain.id}`;

  try {
    const cachedRaw = storage.getString(cacheKey);
    const tsRaw = storage.getString(tsKey);
    const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
    if (cachedRaw && Date.now() - ts < SUI_TOKENS_STALE_MS) {
      const parsed = JSON.parse(cachedRaw);
      return Array.isArray(parsed) ? (parsed as TToken[]) : [];
    }
    const { tokenApi } = await import("@/api/endpoints/tokens");
    const tokens = await tokenApi.searchTokens({
      blockchainId: suiBlockchain.id,
      isActive: true,
    });
    storage.set(cacheKey, JSON.stringify(tokens));
    storage.set(tsKey, Date.now().toString());
    return tokens;
  } catch {
    // Offline fallback: serve stale cache if available, else empty.
    const cachedRaw = storage.getString(cacheKey);
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw);
        return Array.isArray(parsed) ? (parsed as TToken[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

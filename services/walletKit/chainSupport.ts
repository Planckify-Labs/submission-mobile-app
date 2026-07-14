/**
 * `SUPPORTED_NAMESPACES` — single source of truth for which chain
 * families are exposed anywhere in the app (wallet creation, chain /
 * network pickers, wallet switcher). Every other registered
 * `WalletKitAdapter` (EVM, Solana, Sui) keeps running underneath —
 * `bootWalletKits` still registers all of them unconditionally per its
 * own contract — but UI surfaces that enumerate "the chains a user can
 * pick" should filter through `isNamespaceSupported` /
 * `getSupportedWalletKits` rather than calling `walletKitRegistry.getAll()`
 * directly.
 *
 * This is an app-only restriction: existing `TWallet` rows on hidden
 * namespaces are NOT deleted (still readable from SecureStore, still
 * recoverable via seed phrase), they're just filtered out of every list/
 * picker so the product reads as Stellar-only.
 *
 * Flipping the app back to multi-chain later is a one-line change here —
 * no call site should hard-code `"stellar"` directly.
 */

import type { TBlockchain } from "@/api/types/blockchain";
import { resolveNamespace } from "@/hooks/useWallet.helpers";
import type { Namespace } from "@/services/chains/types";
import { walletKitRegistry } from "./registry";
import type { WalletKitAdapter } from "./types";

export const SUPPORTED_NAMESPACES: readonly Namespace[] = ["stellar"];

export function isNamespaceSupported(ns: Namespace): boolean {
  return SUPPORTED_NAMESPACES.includes(ns);
}

/** `walletKitRegistry.getAll()`, filtered down to supported namespaces. */
export function getSupportedWalletKits(): WalletKitAdapter[] {
  return walletKitRegistry
    .getAll()
    .filter((kit) => isNamespaceSupported(kit.namespace));
}

/** Filters a `/blockchains` row list down to supported-namespace rows. */
export function filterSupportedBlockchains(rows: TBlockchain[]): TBlockchain[] {
  return rows.filter((row) => isNamespaceSupported(resolveNamespace(row)));
}

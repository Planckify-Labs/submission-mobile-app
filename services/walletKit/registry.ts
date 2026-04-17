/**
 * `walletKitRegistry` — resolves a `WalletKitAdapter` by `Namespace`.
 *
 * Per spec §4.5:
 *   - `get(ns)` THROWS when no kit is registered for the namespace.
 *     Returning `null` would force every caller to null-check and mask
 *     boot-order bugs; throwing makes a missing-kit incident loud and
 *     obvious during development.
 *   - `getAll()` is insertion-ordered (Map spec). UI pickers depend on
 *     EVM-registered-first / Solana-registered-second ordering without
 *     explicit sorting.
 *
 * Rules (Task 04): no `react` / `react-native` / `viem` imports in this
 * module. Registration of concrete kits happens in `boot.ts` (Task 06).
 */

import type { Namespace } from "@/services/chains/types";
import type { WalletKitAdapter } from "./types";

class WalletKitRegistryImpl {
  private readonly kits = new Map<Namespace, WalletKitAdapter>();

  register(adapter: WalletKitAdapter): void {
    this.kits.set(adapter.namespace, adapter);
  }

  get(ns: Namespace): WalletKitAdapter {
    const kit = this.kits.get(ns);
    if (!kit) {
      throw new Error(`WalletKit not registered for namespace: ${ns}`);
    }
    return kit;
  }

  has(ns: Namespace): boolean {
    return this.kits.has(ns);
  }

  getAll(): WalletKitAdapter[] {
    return Array.from(this.kits.values());
  }

  /**
   * Test-only helper. Not part of the public `WalletKitRegistry`
   * contract — kept off the interface so product code cannot depend on
   * clearing at runtime.
   */
  clear(): void {
    this.kits.clear();
  }
}

export { WalletKitRegistryImpl };

export const walletKitRegistry = new WalletKitRegistryImpl();

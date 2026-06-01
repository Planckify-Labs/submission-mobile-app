/**
 * `gasAbstractionRegistry` — resolves a `GasAbstractionProvider` for a
 * given chain. Mirrors `walletKitRegistry`: providers register at boot
 * (`./boot.ts`), and `resolveProvider(chain)` returns the first provider
 * that supports the chain, or `null` when none do (caller falls back to
 * the native gas path).
 *
 * Insertion order is the priority order — the first registered provider
 * that `supportsChain` wins. Today only 1Shot is registered; a future
 * Circle Paymaster / Biconomy provider can be registered ahead of or
 * behind it without changing any call site.
 *
 * Rules: no `react` / `react-native` / `viem` imports.
 */

import type { ChainConfig } from "@/constants/configs/chainConfig";
import type { GasAbstractionProvider } from "./types";

class GasAbstractionRegistryImpl {
  private readonly providers: GasAbstractionProvider[] = [];

  register(provider: GasAbstractionProvider): void {
    // Idempotent on id so a double boot doesn't duplicate providers.
    if (this.providers.some((p) => p.id === provider.id)) return;
    this.providers.push(provider);
  }

  /** First provider (in registration order) that supports the chain. */
  resolveProvider(chain: ChainConfig): GasAbstractionProvider | null {
    return this.providers.find((p) => p.supportsChain(chain)) ?? null;
  }

  getById(id: string): GasAbstractionProvider | null {
    return this.providers.find((p) => p.id === id) ?? null;
  }

  getAll(): GasAbstractionProvider[] {
    return [...this.providers];
  }

  /** Test-only — not part of the public contract. */
  clear(): void {
    this.providers.length = 0;
  }
}

export { GasAbstractionRegistryImpl };

export const gasAbstractionRegistry = new GasAbstractionRegistryImpl();

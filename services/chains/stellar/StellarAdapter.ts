/**
 * Stellar dApp-bridge adapter — SCAFFOLD, disabled in v1.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §5, §11.
 *
 * Unlike Sui (a ratified Wallet Standard extension to implement),
 * Stellar has no single formalized injected-provider standard the
 * ecosystem converges on — Freighter's `window.freighterApi` shape and
 * "Stellar Wallets Kit" are the closest things, but which one (if
 * either) to emulate needs its own research spike before
 * implementation (§11 risk row 2). This adapter is registered behind
 * `FEATURE_STELLAR_DAPP_BRIDGE = false` in `services/bridge/boot.ts` —
 * every request fails loud with a fixed "not enabled" error rather than
 * attempting a best-guess protocol.
 */

import type {
  AdapterContext,
  ChainAdapter,
  ChainRequest,
  ChainResult,
} from "@/services/chains/types";
import { getStellarInjectedScript } from "./injectedScript";

class StellarAdapter implements ChainAdapter {
  readonly namespace = "stellar" as const;

  getInjectedScript(_ctx: AdapterContext): string {
    void _ctx;
    return getStellarInjectedScript();
  }

  onStateChange(_ctx: AdapterContext): { injectedJs: string } | null {
    void _ctx;
    return null;
  }

  async handleRequest(
    _req: ChainRequest,
    _ctx: AdapterContext,
  ): Promise<ChainResult> {
    void _req;
    void _ctx;
    return {
      status: "error",
      code: 4200,
      message: "Stellar dApp bridge not enabled in this build",
    };
  }

  async executeApproval(): Promise<unknown> {
    throw new Error("Stellar dApp bridge not enabled in this build");
  }
}

export { StellarAdapter };

export function createStellarAdapter(): ChainAdapter {
  return new StellarAdapter();
}

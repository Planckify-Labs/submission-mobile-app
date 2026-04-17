import { createSolanaRpc } from "@solana/kit";
import type { WebView } from "react-native-webview";
import { evmRenderers } from "@/components/dapps-browser/approvals/renderers";
import { createEvmAdapter } from "@/services/chains/evm/EvmAdapter";
import { ChainAdapterRegistry } from "@/services/chains/registry";
import { createSolanaAdapter } from "@/services/chains/solana/SolanaAdapter";
import { installSolanaSigner } from "@/services/chains/solana/signer";
import type { AdapterContext } from "@/services/chains/types";
import { PermissionStore } from "@/services/permissions/store";
import { walletKitRegistry } from "@/services/walletKit/registry";
import { initDappBridge } from "./DappBridge";
import { bridgeEventBus } from "./events";
import { InspectorRegistry } from "./inspector";
import { HeuristicInspector } from "./inspectors/HeuristicInspector";
import { HttpsInspector } from "./inspectors/HttpsInspector";
import { SolanaProgramDecoderInspector } from "./inspectors/SolanaProgramDecoderInspector";
import { SolanaSimulationInspector } from "./inspectors/SolanaSimulationInspector";
import { SolanaSiwsInspector } from "./inspectors/SolanaSiwsInspector";
import { pendingIntentsStore } from "./pendingIntents";
import { registerRenderer } from "./renderers";
import { ConsoleSink } from "./sinks/ConsoleSink";

interface BootOpts {
  getContext: () => AdapterContext;
  getWebView: () => WebView | null;
  resolveEvmChain: Parameters<typeof createEvmAdapter>[0]["resolveChainConfig"];
  onSwitchChain?: Parameters<typeof createEvmAdapter>[0]["onSwitchChain"];
  onWatchAsset?: Parameters<typeof createEvmAdapter>[0]["onWatchAsset"];
  onShowCallsStatus?: Parameters<
    typeof createEvmAdapter
  >[0]["onShowCallsStatus"];
}

let booted = false;

/**
 * One-shot boot — registers adapters, inspectors, renderers, and the
 * DappBridge. Safe to call more than once: the guard short-circuits repeat
 * calls, but re-binds the per-screen getters.
 */
export function bootBridge(opts: BootOpts) {
  const bridge = initDappBridge({
    getContext: opts.getContext,
    getWebView: opts.getWebView,
  });

  if (booted) return bridge;
  booted = true;

  InspectorRegistry.register(HttpsInspector);
  InspectorRegistry.register(HeuristicInspector);
  InspectorRegistry.register(SolanaProgramDecoderInspector);
  InspectorRegistry.register(SolanaSimulationInspector);
  InspectorRegistry.register(SolanaSiwsInspector);

  bridgeEventBus.subscribe(ConsoleSink);

  for (const r of evmRenderers) registerRenderer(r);

  const evmAdapter = createEvmAdapter({
    resolveChainConfig: opts.resolveEvmChain,
    onSwitchChain: opts.onSwitchChain,
    onWatchAsset: opts.onWatchAsset,
    onShowCallsStatus: opts.onShowCallsStatus,
  });
  ChainAdapterRegistry.register(evmAdapter);

  // Solana is zero-config until a wallet with namespace "solana" exists;
  // registering lets dApps see the Wallet Standard announcement.
  const solanaAdapter = createSolanaAdapter();
  ChainAdapterRegistry.register(solanaAdapter);

  // Task 17 (spec §7.8) — wire the SolanaAdapter scaffold's
  // `registerSolanaSigner` to the first-party `SolanaWalletKit`. The kit
  // is resolved once inside `installSolanaSigner`; this install must
  // happen AFTER `createSolanaAdapter()` so the signer slot exists, and
  // AFTER `bootWalletKits()` (called at app boot in `app/_layout.tsx`) so
  // the kit registry is populated.
  //
  // `getRpcForCluster` uses Solana's public endpoints. The UI-facing
  // per-user rpcUrl is sourced from the backend `/blockchains` feed
  // (see `ChainSelector` / `buildChainConfigFromBlockchain`) and threads
  // into the kit's `sendNativeTransfer` via `activeChain`. The bridge
  // signer runs in a non-React context and services a dApp-supplied
  // cluster hint — public defaults are the correct fallback there.
  // `rpcSubs` is omitted: public RPCs rate-limit WS subscriptions;
  // private subscription URLs are future work.
  // Boot-order precondition. Any kit whose adapter is registered above
  // MUST have its `WalletKitAdapter` in `walletKitRegistry` before we
  // reach this point, otherwise signer installation (here and for any
  // future chain) silently degrades to "no signer registered" runtime
  // errors when a dApp tries to sign. Check explicitly so the failure
  // mode is a loud dev-time warning tied to the offending chain, not
  // a `-32603` at first signMessage.
  //
  // Fast Refresh corner case: the registry module can be re-evaluated
  // (and cleared) while this module's `booted` flag is still `true`.
  // When the kit is missing, we reset `booted` so the next mount retries
  // — no throw, because retry is the correct behaviour.
  if (walletKitRegistry.has("solana")) {
    installSolanaSigner({
      getWalletByAddress: (addr) =>
        opts.getContext().wallets.find((w) => w.address === addr),
      getRpcForCluster: (cluster) => {
        const url =
          cluster === "devnet"
            ? "https://api.devnet.solana.com"
            : "https://api.mainnet-beta.solana.com";
        return { rpc: createSolanaRpc(url) };
      },
    });
  } else {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[bridge] Solana kit not registered in walletKitRegistry; " +
          "Solana dApp signing disabled until next bootBridge. " +
          "Did `bootWalletKits()` run before `bootBridge()`?",
      );
    }
    booted = false;
  }

  void PermissionStore.hydrate();
  void pendingIntentsStore.hydrate();

  return bridge;
}

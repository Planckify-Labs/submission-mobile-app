/**
 * Stellar injected-provider script — SCAFFOLD ONLY, disabled in v1.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §5, §11.
 *
 * Unlike Sui/Solana (which implement a ratified Wallet Standard
 * extension), Stellar has no single formalized injected-provider
 * standard the ecosystem converges on. Freighter's `window.freighterApi`
 * shape and "Stellar Wallets Kit" are the closest things, but which one
 * (if either) an in-app WebView should emulate needs its own research
 * spike before implementation — not guessed at here. This returns an
 * inert comment so `StellarAdapter.getInjectedScript` has something
 * safe to inject while the dApp bridge stays disabled
 * (`FEATURE_STELLAR_DAPP_BRIDGE = false` in `services/bridge/boot.ts`).
 */

export function getStellarInjectedScript(): string {
  return "/* stellar injected provider not enabled */";
}

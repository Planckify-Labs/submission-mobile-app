/**
 * `installStellarSigner` — SCAFFOLD ONLY, disabled in v1.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §5, §11.
 *
 * Mirrors the shape of `services/chains/solana/signer.ts` /
 * `services/chains/sui/signer.ts` (a `registerXSigner`-style install
 * hook that binds the DApp-bridge adapter to the first-party wallet
 * kit) so a future implementation slots in without a rename. Left
 * unimplemented because there is no ratified Stellar injected-provider
 * standard to sign against yet (§5, §11 risk row 2) — `StellarAdapter`
 * itself is never registered while `FEATURE_STELLAR_DAPP_BRIDGE = false`
 * (`services/bridge/boot.ts`), so this function is never called in v1.
 */
export function installStellarSigner(): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(
      "[stellar] installStellarSigner called, but the Stellar dApp bridge is a scaffold — no signer wired.",
    );
  }
}

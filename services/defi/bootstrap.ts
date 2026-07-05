/**
 * DeFi adapter bootstrap — phased registration.
 *
 * Spec: docs/defi-strategies-spec.md §5.3 / §17 / §24.5#3.
 *
 * Phase 1 (always-on): Aave v3 (Eth/Base/Arb), Lido (Mainnet), Curve
 * 3pool, Morpho Steakhouse USDC (Ethereum).
 *
 * Phase 2 (FEATURE_DEFI_PHASE_2 — default ON): Morpho Flagship USDC
 * Base, Jito SOL, Maple syrupUSDC (EVM mainnet + Base).
 *
 * Phase 3 (FEATURE_DEFI_PHASE_3 — default ON): Yearn v3 USDC,
 * EigenLayer (Eth/Holesky), Ethena sUSDe, GMX v2 Arbitrum.
 *
 * Testnet adapters register when `FEATURE_DEFI_TESTNET_ADAPTERS` is
 * on — used by QA so production user lists stay clean.
 */

import {
  FEATURE_DEFI_PHASE_2,
  FEATURE_DEFI_PHASE_3,
  FEATURE_DEFI_SUI_ADAPTERS,
  FEATURE_DEFI_TESTNET_ADAPTERS,
} from "@/constants/configs/featureFlags";
import { walletKitRegistry } from "@/services/walletKit/registry";
import {
  AaveV3ArbitrumAdapter,
  AaveV3ArbitrumSepoliaAdapter,
  AaveV3BaseAdapter,
  AaveV3BaseSepoliaAdapter,
  AaveV3EthereumAdapter,
  AaveV3EthereumSepoliaAdapter,
} from "./adapters/aaveV3";
import { Curve3poolAdapter } from "./adapters/curve3pool";
import {
  EigenLayerEthereumAdapter,
  EigenLayerHoleskyAdapter,
} from "./adapters/eigenlayer";
import { EmberSuiAdapter } from "./adapters/emberSui";
import { Erc4626Adapter } from "./adapters/erc4626";
import { EthenaEthereumAdapter } from "./adapters/ethena";
import { GmxV2ArbitrumAdapter } from "./adapters/gmxV2";
import { LidoHoleskyAdapter, LidoMainnetAdapter } from "./adapters/lido";
import {
  MapleSyrupUsdcBaseAdapter,
  MapleSyrupUsdcEthereumAdapter,
} from "./adapters/maple";
import {
  MorphoFlagshipUsdcBaseAdapter,
  MorphoSteakhouseUsdcEthAdapter,
  MorphoVaultAdapter,
} from "./adapters/morpho";
import { NaviSuiAdapter } from "./adapters/naviSui";
import { ScallopSuiAdapter } from "./adapters/scallopSui";
import { SolanaJitoAdapter } from "./adapters/solanaJito";
import { SuiLstAdapter } from "./adapters/suiLst";
// SuilendSuiAdapter is implemented but NOT registered — Suilend's deposit AND
// withdraw both assert a fresh reserve price (abort code 1), needing a Pyth
// pull-oracle push in-tx (deferred). Registering it would badge Suilend
// "in-app" then intermittently fail. Wire the Pyth push, then register it.
import {
  YearnV3EthereumAdapter,
  YearnV3UsdcEthereumAdapter,
} from "./adapters/yearnV3";
import { registerDefiAdapter } from "./registry";

let booted = false;

export function bootDefi(): void {
  if (booted) return;
  if (walletKitRegistry.getAll().length === 0) {
    // The DeFi registry has no signing capability of its own — every
    // adapter dispatches submission through `WalletKitAdapter`. Boot
    // order matters; fail loud per spec §24.5#3.
    throw new Error(
      "[bootDefi] walletKitRegistry is empty. Must boot wallets first.",
    );
  }

  // ── Phase 1 (always on) ──────────────────────────────────────────
  // Generic ERC-4626 family adapter (pool-level deposits §7) — routed by
  // `DepositTarget.kind`, so ONE registration covers every Morpho/Yearn/
  // Euler vault the backend resolver returns. Bespoke per-deployment adapters
  // below still resolve by slug for the legacy/canonical path.
  registerDefiAdapter(Erc4626Adapter);
  registerDefiAdapter(AaveV3EthereumAdapter);
  registerDefiAdapter(AaveV3BaseAdapter);
  registerDefiAdapter(AaveV3ArbitrumAdapter);
  registerDefiAdapter(LidoMainnetAdapter);
  registerDefiAdapter(Curve3poolAdapter);
  registerDefiAdapter(MorphoSteakhouseUsdcEthAdapter);
  registerDefiAdapter(MorphoVaultAdapter); // legacy slug alias

  // ── Phase 2 ──────────────────────────────────────────────────────
  if (FEATURE_DEFI_PHASE_2) {
    registerDefiAdapter(MorphoFlagshipUsdcBaseAdapter);
    registerDefiAdapter(SolanaJitoAdapter);
    registerDefiAdapter(MapleSyrupUsdcEthereumAdapter);
    registerDefiAdapter(MapleSyrupUsdcBaseAdapter);
  }

  // ── Phase 3 ──────────────────────────────────────────────────────
  if (FEATURE_DEFI_PHASE_3) {
    registerDefiAdapter(YearnV3UsdcEthereumAdapter);
    registerDefiAdapter(YearnV3EthereumAdapter); // legacy slug alias
    registerDefiAdapter(EigenLayerEthereumAdapter);
    registerDefiAdapter(EthenaEthereumAdapter);
    registerDefiAdapter(GmxV2ArbitrumAdapter);
  }

  // ── Sui adapters (Intent Engine) ────────────────────────────────
  // Scallop is mainnet-only; `chainId:"mainnet"` makes it inert on
  // testnet via the registry's network gate (spec §4.6).
  if (FEATURE_DEFI_SUI_ADAPTERS) {
    registerDefiAdapter(ScallopSuiAdapter);
    // Ember (Bluefin) — generic Sui vault family, routed by
    // `DepositTarget.kind === "ember-vault"` (pool-level deposits §7). One
    // adapter covers every Ember vault the backend resolver returns.
    registerDefiAdapter(EmberSuiAdapter);
    // NAVI — Sui money market, routed by `DepositTarget.kind === "navi-pool"`.
    registerDefiAdapter(NaviSuiAdapter);
    // Liquid staking (Haedal / Volo / SpringSui / Aftermath) — ONE adapter for
    // every LST venue, routed by `DepositTarget.kind === "sui-lst"`. Deposits are
    // oracle-free (no Pyth), so they badge "Deposit in-app". The LST opportunity
    // rows are synthesized server-side (they are not in DeFiLlama's Sui pools).
    registerDefiAdapter(SuiLstAdapter);
    // Suilend NOT registered — deposit + withdraw are Pyth-gated (see import
    // note). Adapter is ready; wire the Pyth push then register here.
  }

  // ── Testnet adapters (QA-only) ──────────────────────────────────
  if (FEATURE_DEFI_TESTNET_ADAPTERS) {
    registerDefiAdapter(AaveV3EthereumSepoliaAdapter);
    registerDefiAdapter(AaveV3BaseSepoliaAdapter);
    registerDefiAdapter(AaveV3ArbitrumSepoliaAdapter);
    registerDefiAdapter(LidoHoleskyAdapter);
    if (FEATURE_DEFI_PHASE_3) {
      registerDefiAdapter(EigenLayerHoleskyAdapter);
    }
  }

  booted = true;
}

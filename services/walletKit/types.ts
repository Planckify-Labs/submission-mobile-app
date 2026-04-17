/**
 * `WalletKitAdapter` — first-party wallet docking port.
 *
 * Mirrors the `ChainAdapter` pattern (see `services/chains/types.ts`), but
 * covers first-party mobile wallet operations that are NOT dApp-originated:
 * keypair creation / import, address validation, native balance fetch,
 * native send, MAX-amount calculation, human/raw amount formatting.
 *
 * Every namespace (`eip155`, `solana`, …) implements this interface and
 * registers itself via `walletKitRegistry` so that UI code (`app/send.tsx`,
 * `app/wallet.tsx`, add-wallet sheets, …) can stay namespace-agnostic.
 *
 * Rules (enforced by spec §4.5 + Task 04):
 *   - No `react` / `react-native` imports — this module must run under a
 *     Node test harness.
 *   - No `viem` imports — viem lives inside `services/walletKit/evm/` only.
 */

import type { ChainConfig } from "@/constants/configs/chainConfig";
import type { TWallet } from "@/constants/types/walletTypes";
import type { Namespace } from "@/services/chains/types";

export type { Namespace };

/**
 * Arguments for `WalletKitAdapter.sendNativeTransfer`.
 *
 * `amount` is the raw native unit (wei for EVM, lamports for Solana, …) so
 * callers never have to juggle human-denominated strings at the adapter
 * boundary.
 */
export interface NativeTransferArgs {
  wallet: TWallet;
  to: string;
  amount: bigint;
  chain: ChainConfig;
}

/**
 * Optional `name` tag applied to newly-created wallets. Kept loose so both
 * EVM and Solana implementations can match the `TWalletCreationParams`
 * shape without forcing a rigid call signature on future chains.
 */
export interface CreateWalletFromPrivateKeyParams {
  privateKey: string;
  name?: string;
}

export interface CreateWalletFromMnemonicParams {
  mnemonic: string;
  name?: string;
}

export interface EstimateMaxTransferableArgs {
  balance: bigint;
  chain: ChainConfig;
  from: string;
  to?: string;
}

export interface TruncateAddressOptions {
  start?: number;
  end?: number;
}

export interface WalletKitAdapter {
  readonly namespace: Namespace;

  // ── Wallet creation & validation ────────────────────────────────────
  validateAddress(address: string): boolean;
  validatePrivateKey(privateKey: string): boolean;
  validateMnemonic(mnemonic: string): boolean;

  createWalletFromPrivateKey(
    params: CreateWalletFromPrivateKeyParams,
  ): Promise<TWallet>;
  createWalletFromMnemonic(
    params: CreateWalletFromMnemonicParams,
  ): Promise<TWallet>;

  generateMnemonic(): string;

  // ── Keys & signers (delegates to walletService dwell sites) ─────────
  /**
   * Returns the kit-specific signer handle for `wallet` (viem `Account`,
   * `KeyPairSigner`, …). The return type is deliberately `unknown | null`
   * so EVM and Solana can return different shapes without leaking types
   * across the port. Callers narrow via `walletKitRegistry.get(ns)`.
   */
  getSignerForWallet(wallet: TWallet): Promise<unknown | null>;

  // ── Reads ───────────────────────────────────────────────────────────
  getNativeBalance(address: string, chain: ChainConfig): Promise<bigint>;

  // ── Writes ──────────────────────────────────────────────────────────
  /** Returns tx hash (EVM) or signature (Solana) as a string. */
  sendNativeTransfer(args: NativeTransferArgs): Promise<string>;

  /**
   * Computes the max transferable amount given `balance`, accounting for
   * fee / rent reserves. Implementations may consult the network via
   * `chain` (gas estimate, rent exemption, …).
   */
  estimateMaxTransferable(args: EstimateMaxTransferableArgs): Promise<bigint>;

  // ── Display ─────────────────────────────────────────────────────────
  /** e.g. `"0.0123 ETH"` / `"0.0123 SOL"`. */
  formatNativeAmount(raw: bigint, chain: ChainConfig): string;
  /** Inverse of `formatNativeAmount` — parses a human string to raw units. */
  parseNativeAmount(human: string, chain: ChainConfig): bigint;
  truncateAddress(address: string, opts?: TruncateAddressOptions): string;

  // ── Optional capability flags ───────────────────────────────────────
  /** `false` for Solana in v2.3.0 (no SPL token support yet). */
  supportsTokenTransfer?: boolean;
  /** `true` by default; future MPC / HW-only chains return `false`. */
  supportsPrivateKeyImport?: boolean;
  /** Human-readable chain family label for UI pickers. */
  displayName?: string;
  /** Icon URL for UI pickers. */
  iconUrl?: string;

  // ── Approval-sheet presentation hooks ───────────────────────────────
  /**
   * Hex colour (e.g. `"#627EEA"`) used as the accent for this chain's
   * namespace chip in approval sheets. Omitting falls back to a neutral
   * grey so adding a new chain without a brand colour still renders.
   */
  brandColor?: string;
  /**
   * Returns the chip label shown on the connect sheet (e.g.
   * `"Solana · Mainnet"`). The payload is whatever the adapter emits for
   * its `connect` intent — kits narrow it themselves. If omitted the sheet
   * falls back to `displayName`.
   */
  formatConnectChipLabel?(payload: unknown): string;
  /**
   * When `true`, the connect sheet gates approval behind the platform
   * biometric prompt. Kits opt in per chain (Solana ships with this on;
   * EVM connect is a free grant for parity with MetaMask). Default `false`.
   */
  requireBiometricForConnect?: boolean;
}

/**
 * Solana-native mobile tool executors.
 *
 * Kept in a dedicated file so EVM executors stay untouched — parallel
 * surfaces rather than retrofitting viem-shaped tools with chain
 * dispatch. Each executor routes through `SolanaWalletKit` via the
 * `walletKitRegistry` so shared code stays chain-agnostic per the
 * space-docking rule (§4.5).
 *
 * Tools implemented here:
 *   - get_wallet_sol_balance  — connected wallet's SOL balance
 *   - get_sol_balance         — arbitrary Solana address balance
 *   - send_sol                — native SOL transfer
 *
 * The agent selects between these and the EVM siblings by reading
 * `wallet_context.namespace` — the tool descriptions on the server
 * spell this out (see `agent-api/src/tools/registry.ts`).
 */

import type { ChainConfig } from "@/constants/configs/chainConfig";
import { storage } from "@/lib/storage/mmkv";
import { walletKitRegistry } from "@/services/walletKit/registry";
import {
  ExecutorError,
  ExecutorErrorCode,
  type MobileToolExecutor,
  optionalString,
  requireString,
  safeExecute,
} from "./types";

const SOLANA_NAMESPACE = "solana" as const;

/**
 * Pull the currently-active chain from the same MMKV slot that
 * `useWallet` writes to. Executors can't read the React Query cache
 * directly, so we deserialize the persisted `ChainConfig` here.
 *
 * Narrow to Solana with a predictable error so callers that fire
 * while the active chain is EVM fail fast instead of crashing inside
 * the kit.
 */
function getActiveSolanaChain(): Extract<ChainConfig, { namespace: "solana" }> {
  const raw = storage.getString("active_chain");
  if (!raw) {
    throw new ExecutorError(
      ExecutorErrorCode.UnsupportedChain,
      "no_active_chain",
    );
  }
  const parsed = JSON.parse(raw) as ChainConfig;
  if (parsed.namespace !== SOLANA_NAMESPACE) {
    throw new ExecutorError(
      ExecutorErrorCode.UnsupportedChain,
      "active_chain_is_not_solana",
    );
  }
  return parsed;
}

function getSolanaKit() {
  if (!walletKitRegistry.has(SOLANA_NAMESPACE)) {
    throw new ExecutorError(
      ExecutorErrorCode.NotImplemented,
      "solana_kit_not_registered",
    );
  }
  return walletKitRegistry.get(SOLANA_NAMESPACE);
}

function requireSolanaAddress(value: string, key: string): string {
  const kit = getSolanaKit();
  if (!kit.validateAddress(value)) {
    throw new ExecutorError(ExecutorErrorCode.InvalidInput, `invalid_${key}`);
  }
  return value;
}

/**
 * `get_wallet_sol_balance` — connected wallet's SOL balance on the
 * active Solana cluster. Returns raw lamports alongside a pre-
 * formatted human string so the LLM never has to divide by 1e9.
 */
export const getWalletSolBalance: MobileToolExecutor = (_input, context) =>
  safeExecute(async () => {
    const address = context.wallet?.address;
    if (!address) {
      throw new ExecutorError(
        ExecutorErrorCode.WalletCannotExecute,
        "no connected wallet",
      );
    }
    if (context.wallet.namespace !== SOLANA_NAMESPACE) {
      throw new ExecutorError(
        ExecutorErrorCode.UnsupportedChain,
        "wallet_not_solana",
      );
    }
    const chain = getActiveSolanaChain();
    const kit = getSolanaKit();
    const lamports = await kit.getNativeBalance(address, chain);
    return {
      status: "success",
      data: {
        address,
        cluster: chain.cluster,
        balance_lamports: lamports.toString(),
        balance_display: kit.formatNativeAmount(lamports, chain),
        symbol: "SOL",
      },
    };
  });

/**
 * `get_sol_balance` — SOL balance for an arbitrary address. Falls
 * back to the connected wallet when the agent omits `address`,
 * mirroring the EVM `get_balance` ergonomics.
 */
export const getSolBalance: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    const kit = getSolanaKit();
    const chain = getActiveSolanaChain();

    const explicit = optionalString(input, "address");
    const address = explicit ?? context.wallet?.address;
    if (!address) {
      throw new ExecutorError(
        ExecutorErrorCode.InvalidInput,
        "missing_or_invalid_address",
      );
    }
    requireSolanaAddress(address, "address");

    const lamports = await kit.getNativeBalance(address, chain);
    return {
      status: "success",
      data: {
        address,
        cluster: chain.cluster,
        balance_lamports: lamports.toString(),
        balance_display: kit.formatNativeAmount(lamports, chain),
        symbol: "SOL",
      },
    };
  });

/**
 * `send_sol` — native SOL transfer from the connected wallet. The
 * dispatcher gates on the approval sheet (`capability: "write"`)
 * before this runs, so by the time we're called the user has
 * confirmed. Returns the tx signature as `tx_hash` for symmetry with
 * EVM writes — the protocol field is chain-agnostic even though its
 * type hint is `0x${string}` on EVM.
 */
export const sendSol: MobileToolExecutor = (input, context) =>
  safeExecute(async () => {
    if (!context.wallet?.address) {
      throw new ExecutorError(
        ExecutorErrorCode.WalletCannotExecute,
        "no connected wallet",
      );
    }
    if (context.wallet.namespace !== SOLANA_NAMESPACE) {
      throw new ExecutorError(
        ExecutorErrorCode.UnsupportedChain,
        "wallet_not_solana",
      );
    }

    const to = requireString(input, "to");
    requireSolanaAddress(to, "to");

    const amountHuman = requireString(input, "amount_sol");
    const amountFloat = parseFloat(amountHuman);
    if (!Number.isFinite(amountFloat) || amountFloat <= 0) {
      throw new ExecutorError(
        ExecutorErrorCode.InvalidInput,
        "invalid_amount_sol",
      );
    }

    const kit = getSolanaKit();
    const chain = getActiveSolanaChain();
    const lamports = kit.parseNativeAmount(amountHuman, chain);
    const signature = await kit.sendNativeTransfer({
      wallet: context.wallet,
      to,
      amount: lamports,
      chain,
    });

    // NOTE: `tx_hash` is typed `0x${string}` and the server's
    // `toolResultPayloadSchema` validates it against a hex regex, so we
    // deliberately do NOT put the Solana base58 signature there. It
    // lives on `data.signature` instead — the pendingTxCard can branch
    // on tool name (`send_sol`) to render/link it correctly.
    return {
      status: "success",
      tx_confirmed: true,
      data: {
        signature,
        to,
        cluster: chain.cluster,
        amount_lamports: lamports.toString(),
        amount_sol: amountHuman,
      },
    };
  });

export const SOLANA_EXECUTORS: Record<string, MobileToolExecutor> = {
  get_wallet_sol_balance: getWalletSolBalance,
  get_sol_balance: getSolBalance,
  send_sol: sendSol,
};

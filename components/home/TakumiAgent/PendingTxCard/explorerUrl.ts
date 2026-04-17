/**
 * Pure helper that turns a `(chain_id, tx_hash)` pair into a block
 * explorer URL the pending-tx card can open via `Linking.openURL`.
 *
 * Contract per task 15:
 *
 *   - Must be pure (no I/O, no async).
 *   - MUST NOT hardcode chain → URL mappings — it reads from the same
 *     source the rest of the wallet uses. We draw from
 *     `constants/configs/chainConfig.ts::supportedChains`, whose
 *     entries are viem `Chain` objects carrying `blockExplorers.default`.
 *   - Unknown `chain_id` → `undefined`. The card's tap action is
 *     disabled downstream.
 *   - Unknown explorer URL for a known chain → `undefined`.
 *
 * We deliberately do NOT fall back to viem's global chains registry.
 * Touching a chain the wallet does not officially support would open a
 * random third-party explorer for a hash the user may not recognise;
 * the safer behaviour is "no tap action".
 */

import { findEvmChainById } from "../../../../constants/configs/chainConfig.ts";

/**
 * Build a block explorer URL for a pending transaction.
 *
 * Returns `undefined` when either the chain is not in the wallet's
 * supported list or the chain has no default explorer configured.
 */
export function buildExplorerUrl(
  chain_id: number,
  tx_hash: string,
): string | undefined {
  if (!chain_id || !tx_hash) return undefined;

  // TODO(task-05): EVM-only; Solana will need a slot-based explorer helper.
  const entry = findEvmChainById(chain_id);
  if (!entry) return undefined;

  const explorer = entry.chain.blockExplorers?.default?.url;
  if (!explorer || typeof explorer !== "string") return undefined;

  // Strip a trailing slash so we can concatenate safely without
  // producing `https://…//tx/0x…`.
  const base = explorer.endsWith("/") ? explorer.slice(0, -1) : explorer;
  return `${base}/tx/${tx_hash}`;
}

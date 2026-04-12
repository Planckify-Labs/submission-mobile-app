/**
 * Background receipt poller for the optimistic-UI pending-tx cards.
 *
 * The agent may not call `get_transaction` after a write tool returns —
 * it often just reports success and moves on. This module fills that gap
 * by polling the chain for the receipt independently of the agent loop,
 * so the "Submitting to the network…" card always resolves without
 * requiring the agent to take a follow-up action.
 *
 * Design constraints:
 *  - Fire-and-forget: callers don't await the promise.
 *  - Never throws out to the caller; errors are logged internally.
 *  - Stops as soon as a terminal receipt (success or revert) is found.
 *  - Gives up after POLL_TIMEOUT_MS and leaves the card as "submitted"
 *    (rather than failing it), since a timeout only means we couldn't
 *    confirm — it does NOT mean the tx failed.
 *  - Uses the same `resolveChainClients` path as the read executors so
 *    chain config stays a single source of truth.
 */

import { resolveChainClients } from "../agent-executors/chainRouter";
import type { ExecutorContext } from "../agent-executors/types";
import { pendingTxStore } from "../pendingTxStore";

/** How long between receipt polling attempts. */
const POLL_INTERVAL_MS = 3_000;

/**
 * How long we poll before giving up. 2 minutes is generous for a
 * typical EVM block time (12 s on mainnet, 2 s on L2s). After this
 * we leave the card in "submitted" state — the tx may still confirm
 * eventually and `get_transaction` from the agent will catch it.
 */
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the chain for `txHash` and update `pendingTxStore` when a
 * terminal state is reached. Called as fire-and-forget from the
 * dispatcher immediately after `pendingTxStore.add()`.
 *
 * @param txHash  The submitted transaction hash.
 * @param chainId The EVM chain id (from `payload.input.chain_id`).
 * @param context The executor context that owns the public client.
 */
export async function pollReceipt(
  txHash: `0x${string}`,
  chainId: number,
  context: ExecutorContext,
): Promise<void> {
  if (chainId === 0) return; // unknown chain — can't poll

  let publicClient: ReturnType<typeof resolveChainClients>["publicClient"];
  try {
    ({ publicClient } = resolveChainClients(chainId, context));
  } catch {
    // Chain not in the registry — nothing to poll against.
    return;
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    // Short-circuit if another code path (e.g. `get_transaction` call
    // from the agent) has already resolved this record.
    const existing = pendingTxStore.get(txHash);
    if (existing && existing.state !== "submitted") return;

    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === "success") {
        pendingTxStore.markConfirmed(txHash, Number(receipt.blockNumber));
      } else {
        // `status: "reverted"` — the tx was mined but execution failed.
        pendingTxStore.markFailed(txHash, "reverted");
      }
      return; // terminal receipt found — stop polling
    } catch {
      // Receipt not available yet (tx still pending in mempool) — keep
      // looping. Any genuine network error is treated the same way:
      // keep trying until the deadline rather than failing immediately.
    }
  }

  // Deadline reached without a receipt. Leave the card in "submitted"
  // so the user can still see the hash and open the block explorer.
  // Do NOT mark it failed — a timeout is not a failure.
}

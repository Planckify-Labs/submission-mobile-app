/**
 * Shared helper to poll a submitted gas-abstraction task until it has an
 * on-chain tx hash. Used by both consumers (`app/send.tsx` and the agent
 * `transfer_erc20` executor) so the optimistic "wait for hash" behaviour
 * is defined once.
 *
 * Resolves with the tx hash as soon as the task is submitted or confirmed
 * (mirrors the native path, which returns on broadcast, not confirmation);
 * throws on terminal failure or timeout.
 */

import type { ChainConfig } from "@/constants/configs/chainConfig";
import type { GasAbstractionProvider } from "./types";

export interface PollRelayerOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

const DEFAULT_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 90_000;

export async function pollRelayerTaskHash(
  provider: GasAbstractionProvider,
  chain: ChainConfig,
  taskId: string,
  opts: PollRelayerOptions = {},
): Promise<string> {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  while (Date.now() < deadline) {
    const status = await provider.getStatus({ chain, taskId });
    if (status.status === "failed") throw new Error("relayer task failed");
    if (status.transactionHash) return status.transactionHash;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("relayer task timed out");
}

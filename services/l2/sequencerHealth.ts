/**
 * L2 sequencer health monitoring.
 */

export type SequencerStatus = "healthy" | "delayed" | "down";

interface SequencerState {
  chainId: number;
  status: SequencerStatus;
  lastCheckedAt: number;
  message?: string;
}

const sequencerStates = new Map<number, SequencerState>();

const SEQUENCER_ENDPOINTS: Record<number, string> = {
  10: "https://mainnet-sequencer.optimism.io/health",
  8453: "https://mainnet-sequencer.base.org/health",
  42161: "https://arb1.arbitrum.io/health",
};

export async function checkSequencerHealth(chainId: number): Promise<SequencerState> {
  const endpoint = SEQUENCER_ENDPOINTS[chainId];
  if (!endpoint) {
    return { chainId, status: "healthy", lastCheckedAt: Date.now() };
  }

  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    const status: SequencerStatus = response.ok ? "healthy" : "delayed";
    const state: SequencerState = { chainId, status, lastCheckedAt: Date.now() };
    sequencerStates.set(chainId, state);
    return state;
  } catch {
    const state: SequencerState = {
      chainId,
      status: "down",
      lastCheckedAt: Date.now(),
      message: `${getChainName(chainId)} sequencer is experiencing delays. Transactions may be slow.`,
    };
    sequencerStates.set(chainId, state);
    return state;
  }
}

export function getSequencerState(chainId: number): SequencerState | null {
  return sequencerStates.get(chainId) ?? null;
}

function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    10: "Optimism",
    8453: "Base",
    42161: "Arbitrum",
  };
  return names[chainId] ?? "L2";
}

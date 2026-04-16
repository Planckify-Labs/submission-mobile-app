// TWV-2026-050 — Private-mempool relay routing for swap-shaped writes.
// Default public RPCs broadcast pending txs to the public mempool
// where searchers sandwich retail swaps; cumulative MEV extraction
// from retail wallets is in the high $100M's per year. Routing
// `eth_sendRawTransaction` for swap-shaped calldata via Flashbots
// Protect / MEV Blocker / Beaverbuild closes that without any new
// user decision at sign time.

export interface ProtectedRelay {
  name: string;
  url: string;
  /** Chains the relay supports. Mainnet today; some support L2s. */
  chainIds: number[];
}

/**
 * Per-chain write-side RPC. Default ON for chainIds present here;
 * per-chain opt-out lives in user settings (see `signingMode.ts`
 * pattern — but for protected-relay this is its own toggle).
 */
export const PROTECTED_RELAYS: ReadonlyArray<ProtectedRelay> = [
  {
    name: "Flashbots Protect",
    url: "https://rpc.flashbots.net",
    chainIds: [1],
  },
  {
    name: "MEV Blocker",
    url: "https://rpc.mevblocker.io",
    chainIds: [1],
  },
];

/**
 * Function selectors that identify swap-shaped calldata. Keep tight —
 * a false positive routes a non-swap through the relay (no harm but
 * adds latency); a false negative leaves a real swap in the public
 * mempool. The list mirrors the well-known router contracts called
 * out in the spec.
 */
const SWAP_SELECTORS: ReadonlySet<string> = new Set([
  // Uniswap V2 router
  "0x38ed1739", // swapExactTokensForTokens
  "0x18cbafe5", // swapExactTokensForETH
  "0x7ff36ab5", // swapExactETHForTokens
  // Uniswap Universal Router
  "0x3593564c", // execute(bytes,bytes[],uint256)
  // Permit2 — often called as part of a swap chain
  "0xab8b1bdb",
]);

/**
 * Pick the relay URL for a (chainId, calldata) pair, or null if no
 * relay is configured for the chain or the calldata isn't swap-shaped.
 */
export function pickProtectedRelay(
  chainId: number,
  calldata: `0x${string}` | undefined,
  options?: { userOptedOut?: boolean },
): ProtectedRelay | null {
  if (options?.userOptedOut) return null;
  if (!calldata || calldata.length < 10) return null;
  const selector = calldata.slice(0, 10).toLowerCase();
  if (!SWAP_SELECTORS.has(selector)) return null;
  // Pick the first configured relay for the chain — failover ordering
  // is the responsibility of `MultiProvider`.
  return PROTECTED_RELAYS.find((r) => r.chainIds.includes(chainId)) ?? null;
}

/**
 * Predicate the signer UI uses to decide whether to render the
 * "Protect this swap" toggle. Returns true if a relay is available
 * for this chain regardless of calldata shape — the toggle visibility
 * shouldn't change based on whether THIS particular tx happens to
 * match the swap-selector heuristic.
 */
export function isProtectableChain(chainId: number): boolean {
  return PROTECTED_RELAYS.some((r) => r.chainIds.includes(chainId));
}

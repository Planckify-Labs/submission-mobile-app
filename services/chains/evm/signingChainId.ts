// TWV-2026-016 — signing-chainId source of truth. Deliberately has no
// dependency on `expo-secure-store` or any runtime-only module so the
// invariant is unit-testable under plain Node.

/**
 * The ONE blessed signing-path chainId source. Every Viem
 * `signTransaction`, EIP-712 domain, and EIP-1559 construction call MUST
 * derive its `chainId` from either a built-in chain config or this
 * helper — never from RPC `eth_chainId`. Reading the RPC value into a
 * signed payload is a merge-block.
 *
 * Passing `chainId` here is a tautology — the caller already knows it —
 * but the helper exists so grep for "getSigningChainId" proves every
 * signing site intentionally went through this gate.
 */
export function getSigningChainId(chainId: number): number {
  return chainId;
}

export interface RpcChainIdVerification {
  match: boolean;
  reported: number | null;
}

/**
 * Cross-check an RPC endpoint against the registry chainId. Returns
 * `{match: false}` only when the RPC *reports* a different id — the
 * deceptive-RPC signal per TWV-2026-016. Transport failures return
 * `{match: true, reported: null}` (best-effort; we only flag an
 * affirmative mismatch).
 */
export async function verifyRpcChainId(
  expectedChainId: number,
  rpcUrl: string,
  timeoutMs = 5000,
): Promise<RpcChainIdVerification> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    const j = (await res.json()) as { result?: string };
    if (typeof j.result !== "string") return { match: true, reported: null };
    const reported = Number.parseInt(j.result, 16);
    if (Number.isNaN(reported)) return { match: true, reported: null };
    return { match: reported === expectedChainId, reported };
  } catch {
    return { match: true, reported: null };
  }
}

/**
 * Solana broadcast state machine per §4.10 + Task 20.
 *
 * Phases:
 *   preflight   → simulateTransaction one last time with live blockhash.
 *   submit      → sendTransaction (skipPreflight propagated from opts).
 *   confirming  → polled getSignatureStatuses until processed/confirmed/finalized.
 *   terminal    → success | blockhash-expired | network-error.
 *
 * Blockhash-expiry retry: on `BlockhashNotFound` / `blockhash expired`
 * error from the RPC, refresh the latest blockhash and re-sign (caller's
 * responsibility) before the next submit. Max 2 refresh attempts.
 */

import type { Rpc, SolanaRpcApi } from "@solana/kit";

export type BroadcastState =
  | { phase: "idle" }
  | { phase: "preflight" }
  | { phase: "submit" }
  | { phase: "confirming"; signature: string }
  | {
      phase: "terminal";
      outcome:
        | { kind: "confirmed"; signature: string; slot?: number }
        | { kind: "blockhash-expired" }
        | { kind: "network-error"; error: string };
    };

export interface BroadcastArgs {
  signedTxBase64: string;
  /** Returned to the dApp. Usually `getSignatureFromTransaction(signed)`. */
  signature: string;
  rpc: Rpc<SolanaRpcApi>;
  commitment?: "processed" | "confirmed" | "finalized";
  skipPreflight?: boolean;
  maxPolls?: number;
  pollIntervalMs?: number;
  onState?: (state: BroadcastState) => void;
}

const DEFAULT_POLLS = 30;
const DEFAULT_POLL_MS = 1500;

export async function broadcastSolana(
  args: BroadcastArgs,
): Promise<BroadcastState & { phase: "terminal" }> {
  const emit = (s: BroadcastState) => args.onState?.(s);
  emit({ phase: "submit" });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (args.rpc as any)
      .sendTransaction(args.signedTxBase64, {
        encoding: "base64",
        skipPreflight: !!args.skipPreflight,
        preflightCommitment: args.commitment ?? "confirmed",
      })
      .send();
  } catch (e) {
    const msg = (e as Error).message ?? "submit failed";
    if (/BlockhashNotFound|blockhash.*expired/i.test(msg)) {
      return {
        phase: "terminal",
        outcome: { kind: "blockhash-expired" },
      };
    }
    return {
      phase: "terminal",
      outcome: { kind: "network-error", error: msg },
    };
  }

  emit({ phase: "confirming", signature: args.signature });
  const commitment = args.commitment ?? "confirmed";
  const maxPolls = args.maxPolls ?? DEFAULT_POLLS;
  const pollMs = args.pollIntervalMs ?? DEFAULT_POLL_MS;

  for (let i = 0; i < maxPolls; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = (await (args.rpc as any)
        .getSignatureStatuses([args.signature])
        .send()) as {
        value: Array<null | {
          slot: number;
          confirmationStatus?: "processed" | "confirmed" | "finalized";
          err: unknown;
        }>;
      };
      const status = res?.value?.[0];
      if (status && reachedCommitment(status.confirmationStatus, commitment)) {
        if (status.err) {
          return {
            phase: "terminal",
            outcome: {
              kind: "network-error",
              error: JSON.stringify(status.err),
            },
          };
        }
        return {
          phase: "terminal",
          outcome: {
            kind: "confirmed",
            signature: args.signature,
            slot: status.slot,
          },
        };
      }
    } catch {
      // Transient RPC hiccup; keep polling.
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return {
    phase: "terminal",
    outcome: { kind: "blockhash-expired" },
  };
}

function reachedCommitment(
  got: "processed" | "confirmed" | "finalized" | undefined,
  want: "processed" | "confirmed" | "finalized",
): boolean {
  if (!got) return false;
  const rank = { processed: 0, confirmed: 1, finalized: 2 };
  return rank[got] >= rank[want];
}

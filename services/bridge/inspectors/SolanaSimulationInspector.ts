/**
 * Solana simulation inspector — runs `simulateTransaction`, emits the
 * summary + §10.4 writable-account / nonce-authority / partial-signer
 * annotations. Consumes the structural fields the program-decoder
 * inspector already patched onto the intent (§4.9: decoder runs at
 * priority 15, simulation at 20).
 */

import type { ApprovalIntent } from "../approval";
import type { IntentInspector } from "../inspector";
import type {
  SolanaSignTxPayload,
  SolanaSimulationSummary,
  SolanaSimulationWarning,
} from "@/services/chains/solana/payloads";
import { getSolanaRpc } from "@/services/rpc/solanaRpcPool";
import { simulateTransaction } from "@/services/chains/solana/simulate";
import {
  analysePartialSigner,
  buildPartialSigningAnnotation,
} from "@/services/chains/solana/partialSigner";
import { buildNonceMismatchAnnotation } from "@/services/chains/solana/durableNonce";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

export const SolanaSimulationInspector: IntentInspector = {
  name: "solana-simulation",
  priority: 20,
  mode: "auto",
  namespaces: ["solana"],
  async inspect(intent: ApprovalIntent) {
    if (intent.kind !== "signTransaction") {
      return { annotations: [], verdict: "allow" };
    }
    const payload = intent.payload as SolanaSignTxPayload;
    if (!payload.transaction || !payload.cluster) {
      return { annotations: [], verdict: "allow" };
    }

    const annotations: ReturnType<IntentInspector["inspect"]> extends Promise<
      infer R
    >
      ? R extends { annotations: infer A }
        ? A
        : never
      : never = [];

    // Partial-signer / fee-payer analysis — derived entirely from
    // decoder-patched fields, no RPC needed.
    if (payload.feePayer && payload.signerAddresses) {
      const analysis = analysePartialSigner({
        feePayer: payload.feePayer,
        activeWallet: payload.address,
        signerAccounts: payload.signerAddresses,
      });
      if (analysis.isPartial || !analysis.activeIsFeePayer) {
        annotations.push(buildPartialSigningAnnotation(analysis));
      }
    }

    // Durable-nonce authority check.
    if (
      payload.durableNonce?.isDurableNonce &&
      payload.durableNonce.authority &&
      payload.durableNonce.authority !== payload.address
    ) {
      annotations.push(
        buildNonceMismatchAnnotation(
          payload.durableNonce.authority,
          payload.address,
        ),
      );
    }

    // Run simulation — best-effort; RPC failure does not block the flow.
    let summary: SolanaSimulationSummary | null = null;
    try {
      const rpc = getSolanaRpc(payload.cluster);
      summary = await simulateTransaction(rpc, {
        txBase64: payload.transaction,
        feePayer: payload.feePayer,
        writableAccounts: payload.writableAddresses,
      });
    } catch {
      // No patch, no annotation from simulation.
    }

    // Writable-system-program check (inv 6 — drain detection cue).
    if (payload.writableAddresses?.includes(SYSTEM_PROGRAM)) {
      const warning: SolanaSimulationWarning = {
        code: "writable.system-program",
        program: SYSTEM_PROGRAM,
      };
      if (summary) summary.warnings.push(warning);
      annotations.push({
        code: "simulation.writable.system-program",
        severity: "danger",
        title: "System program marked writable",
        detail:
          "A transaction should never mark the System program account as writable — this is a red flag for a crafted instruction that tries to bypass validation.",
        source: "simulation",
      });
    }

    if (summary) {
      for (const w of summary.warnings) {
        annotations.push({
          code: `simulation.${w.code}`,
          severity:
            w.code === "writable.system-program" ||
            w.code === "nonce.authority-mismatch" ||
            w.code === "ata.close-authority-change" ||
            w.code === "setAuthority"
              ? ("danger" as const)
              : ("warn" as const),
          title: `Simulation: ${w.code}`,
          detail: JSON.stringify(w),
          source: "simulation",
        });
      }
    }

    return {
      annotations,
      verdict: annotations.some(
        (a: { severity: string }) => a.severity === "danger",
      )
        ? "require-extra-confirmation"
        : "allow",
      patch: summary
        ? ({
            ...(payload as object),
            simulation: summary,
          } as Partial<ApprovalIntent["payload"]>)
        : undefined,
    };
  },
};

/**
 * Stellar preflight inspector — targeted Horizon reads substituting for
 * the transaction simulation classic Stellar operations don't have
 * (Horizon has no dry-run endpoint; Stellar RPC's `simulateTransaction`
 * is Soroban-only, §0/§8.2 non-goal).
 *
 * Spec reference: `docs/stellar-dapp-bridge-spec.md` §8.2.
 *
 * Runs at priority 20 (after `StellarXdrDecoderInspector` at 15) so it
 * can consume the decoder's patched `payload.decoded` destination/asset
 * fields. Reuses `detectAccountFunded`/`hasTrustline`
 * (`stellar-chain-support-spec.md`, already shipped) — the exact same
 * primitives the first-party send flow's pre-flight check uses.
 *
 * Multi-operation transactions (more than one payment) are NOT
 * preflighted in v1 — flagged as future work rather than adding N
 * Horizon round-trips to every batched dApp transaction (§16).
 */

import { detectAccountFunded } from "@/services/chains/stellar/accountState";
import {
  getHorizonClient,
  resolveStellarChainConfigForPassphrase,
} from "@/services/chains/stellar/horizonClient";
import type { StellarSignTransactionPayload } from "@/services/chains/stellar/payloads";
import { hasTrustline } from "@/services/chains/stellar/trustlineService";
import type { ApprovalIntent } from "../approval";
import type { IntentAnnotation, IntentInspector } from "../inspector";

export const StellarPreflightInspector: IntentInspector = {
  name: "stellar-preflight",
  priority: 20,
  mode: "auto",
  namespaces: ["stellar"],
  async inspect(intent: ApprovalIntent) {
    if (intent.kind !== "signTransaction") {
      return { annotations: [], verdict: "allow" };
    }
    const payload = intent.payload as StellarSignTransactionPayload;
    const ops = payload.decoded;
    if (!ops) {
      // Decoder hasn't run (or failed) — nothing to preflight against.
      return { annotations: [], verdict: "allow" };
    }

    const payments = ops.filter(
      (o): o is Extract<(typeof ops)[number], { kind: "payment" }> =>
        o.kind === "payment",
    );
    if (payments.length !== 1) {
      // §8.2 — only the common single-payment case is preflighted in v1.
      return { annotations: [], verdict: "allow" };
    }
    const payment = payments[0];

    const chain = resolveStellarChainConfigForPassphrase(
      payload.networkPassphrase,
    );
    const horizon = getHorizonClient(chain);

    const annotations: IntentAnnotation[] = [];

    let destinationExists: boolean;
    try {
      destinationExists = await detectAccountFunded(
        horizon,
        payment.destination,
      );
    } catch {
      // Best-effort — skip silently on a non-404 Horizon error (rate
      // limit, network blip). A skipped check means no annotation, not
      // a blocking error; Horizon's own submission-time error remains
      // the fallback safety net.
      return { annotations: [], verdict: "allow" };
    }

    if (!destinationExists) {
      annotations.push({
        code: "destination.unfunded",
        severity: "warn",
        title: "Recipient not yet funded",
        detail:
          "This recipient has never received XLM; the payment will fail unless it's a createAccount operation instead.",
        source: "stellar-preflight",
      });
      return {
        annotations,
        verdict: "allow",
        patch: {
          ...(payload as object),
          preflight: { destinationExists: false },
        } as Partial<ApprovalIntent["payload"]>,
      };
    }

    if (payment.asset === "native") {
      return {
        annotations,
        verdict: "allow",
        patch: {
          ...(payload as object),
          preflight: { destinationExists: true },
        } as Partial<ApprovalIntent["payload"]>,
      };
    }

    const sep = payment.asset.indexOf(":");
    const code = sep > 0 ? payment.asset.slice(0, sep) : "";
    const issuer = sep > 0 ? payment.asset.slice(sep + 1) : "";
    if (!code || !issuer) {
      return {
        annotations,
        verdict: "allow",
        patch: {
          ...(payload as object),
          preflight: { destinationExists: true },
        } as Partial<ApprovalIntent["payload"]>,
      };
    }

    let destinationHasTrustline: boolean | undefined;
    try {
      destinationHasTrustline = await hasTrustline(
        horizon,
        payment.destination,
        code,
        issuer,
      );
    } catch {
      // Best-effort — same skip-silently posture as the funded check.
      return {
        annotations,
        verdict: "allow",
        patch: {
          ...(payload as object),
          preflight: { destinationExists: true },
        } as Partial<ApprovalIntent["payload"]>,
      };
    }

    if (!destinationHasTrustline) {
      annotations.push({
        code: "destination.no-trustline",
        severity: "warn",
        title: "Recipient hasn't set up this asset",
        detail: `${payment.destination} has no trustline to ${code} — the payment will fail with op_no_trust.`,
        source: "stellar-preflight",
      });
    }

    return {
      annotations,
      verdict: "allow",
      patch: {
        ...(payload as object),
        preflight: { destinationExists: true, destinationHasTrustline },
      } as Partial<ApprovalIntent["payload"]>,
    };
  },
};

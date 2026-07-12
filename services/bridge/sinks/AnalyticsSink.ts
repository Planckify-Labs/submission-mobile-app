/**
 * Product-analytics sink — fires `dapp_connected` / `dapp_transaction_approved`
 * on successful dApp bridge outcomes. Mirrors `TelemetrySink`'s
 * intent-id ledger pattern (that sink's own docstring calls itself "the
 * single seam" for exactly this kind of addition — see its header comment).
 *
 * Only successful results count as value events: a rejected or errored
 * `result` fires nothing.
 */
import { toChainTag } from "@/services/analytics/chainTag";
import { track } from "@/services/analytics/posthog";
import { originHost } from "@/services/permissions/caip";
import type { BridgeEvent, BridgeEventSink } from "../events";

const TX_KINDS = new Set([
  "signTransaction",
  "sendTransaction",
  "signAllTransactions",
  "sendCalls",
]);

interface PendingIntent {
  kind: string;
  chain: string;
  dappHost?: string;
  dappName?: string;
}

const pending = new Map<string, PendingIntent>();
const PENDING_CAP = 256;

function recordIntent(id: string, entry: PendingIntent): void {
  if (pending.has(id)) return;
  if (pending.size >= PENDING_CAP) {
    const first = pending.keys().next().value;
    if (typeof first === "string") pending.delete(first);
  }
  pending.set(id, entry);
}

export const AnalyticsSink: BridgeEventSink = {
  emit(e: BridgeEvent) {
    switch (e.kind) {
      case "intent": {
        recordIntent(e.intent.id, {
          kind: e.intent.kind,
          chain: toChainTag(e.intent.namespace),
          dappHost: originHost(e.intent.origin.url),
          dappName: e.intent.origin.title,
        });
        break;
      }
      case "result": {
        const entry = pending.get(e.id);
        pending.delete(e.id);
        if (!entry || !e.ok) return;
        if (entry.kind === "connect") {
          track("dapp_connected", {
            chain: entry.chain,
            dapp_host: entry.dappHost,
            dapp_name: entry.dappName,
          });
        } else if (TX_KINDS.has(entry.kind)) {
          track("dapp_transaction_approved", {
            chain: entry.chain,
            method: entry.kind,
            dapp_host: entry.dappHost,
            dapp_name: entry.dappName,
          });
        }
        break;
      }
    }
  },
};

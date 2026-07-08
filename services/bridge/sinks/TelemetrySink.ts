/**
 * Telemetry sink — per-namespace `chain` tag + per-method latency timer
 * shaping. Today the sink emits structured breadcrumbs to `console.info`
 * (dev only); when the project's Sentry SDK lands, this sink is the
 * single seam to add `Sentry.addBreadcrumb` / `Sentry.setTag` calls
 * without touching the rest of the bridge.
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §15 (task 15) — extend
 * `bridgeEventBus` consumers with `chain=sui` tags + per-method timers,
 * mirroring Solana telemetry. `docs/stellar-dapp-bridge-spec.md` §13
 * (task 13) extends the same tagging to `chain=stellar` — a sink change
 * only, no adapter-side plumbing.
 *
 * Tagging rules:
 *   - `chain` follows the bridge `Namespace`: `eip155` → `evm`,
 *     `solana` → `solana`, `sui` → `sui`, `stellar` → `stellar`.
 *     dApp-side Sui/Stellar CAIP-2 references (`sui:mainnet`,
 *     `stellar:mainnet`, etc.) are NOT collapsed; a future extension can
 *     split per-network when needed.
 *   - `method` carries the wire method verbatim — so `sui:signTransaction`
 *     and `sui:signAndExecuteTransaction` are distinguishable in the
 *     timer histogram.
 *   - `legacy=true` is added for the two Sui legacy aliases so a
 *     dashboard can track when they retire.
 *
 * Privacy:
 *   - Emits redacted params via `redactParams` (already done by the
 *     dispatcher); this sink never re-decorates with raw payload data.
 *   - Errors carry only `{ code, messageHash }` — full message text is
 *     dropped at the breadcrumb boundary.
 */

import type { BridgeEvent, BridgeEventSink } from "../events";
import { redactParams, scrubLoggerPayload } from "../redact";

const namespaceToChainTag: Record<string, string> = {
  eip155: "evm",
  solana: "solana",
  sui: "sui",
  stellar: "stellar",
};

const SUI_LEGACY_METHODS: ReadonlySet<string> = new Set([
  "sui:signTransactionBlock",
  "sui:signAndExecuteTransactionBlock",
]);

/**
 * Per-id `startedAt` ledger — populated on `request`, drained on
 * `decision` / `result`. Capped at 256 entries; stale ids beyond the
 * cap are evicted FIFO so a runaway dApp can't grow the map without
 * bound.
 */
const inflight = new Map<
  string,
  { at: number; method: string; chain: string }
>();
const INFLIGHT_CAP = 256;

function recordStart(id: string, method: string, chain: string): void {
  if (inflight.has(id)) return;
  if (inflight.size >= INFLIGHT_CAP) {
    const first = inflight.keys().next().value;
    if (typeof first === "string") inflight.delete(first);
  }
  inflight.set(id, { at: Date.now(), method, chain });
}

function peekFinish(id: string): {
  durationMs: number;
  method: string;
  chain: string;
} | null {
  const e = inflight.get(id);
  if (!e) return null;
  return { durationMs: Date.now() - e.at, method: e.method, chain: e.chain };
}

function takeFinish(id: string): {
  durationMs: number;
  method: string;
  chain: string;
} | null {
  const e = inflight.get(id);
  if (!e) return null;
  inflight.delete(id);
  return { durationMs: Date.now() - e.at, method: e.method, chain: e.chain };
}

interface BreadcrumbShape {
  category: string;
  level: "info" | "warning" | "error";
  data: Record<string, unknown>;
}

function emitBreadcrumb(b: BreadcrumbShape): void {
  // TODO: when Sentry SDK lands, replace with Sentry.addBreadcrumb(b).
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(
      "[bridge.telemetry]",
      b.category,
      b.level,
      scrubLoggerPayload(b.data),
    );
  }
}

/** Test-only escape hatch — clears the in-flight ledger between tests. */
export function __clearTelemetryInflightForTesting(): void {
  inflight.clear();
}

export const TelemetrySink: BridgeEventSink = {
  emit(e: BridgeEvent) {
    switch (e.kind) {
      case "request": {
        const chain = namespaceToChainTag[e.namespace] ?? e.namespace;
        recordStart(e.id, e.method, chain);
        emitBreadcrumb({
          category: "bridge.request",
          level: "info",
          data: {
            id: e.id,
            chain,
            namespace: e.namespace,
            method: e.method,
            legacy: SUI_LEGACY_METHODS.has(e.method) || undefined,
            origin: e.origin?.url,
            params: redactParams(e.method, e.params),
          },
        });
        break;
      }
      case "intent": {
        emitBreadcrumb({
          category: "bridge.intent",
          level: "info",
          data: {
            id: e.intent.id,
            chain:
              namespaceToChainTag[e.intent.namespace] ?? e.intent.namespace,
            namespace: e.intent.namespace,
            kind: e.intent.kind,
            verdict: e.verdict,
            annotations: e.annotations.map((a) => a.code),
          },
        });
        break;
      }
      case "decision": {
        // Peek (not take) — `result` fires next and needs the same
        // ledger entry to compute durationMs / method / chain.
        const finish = peekFinish(e.id);
        emitBreadcrumb({
          category: "bridge.decision",
          level: e.outcome === "reject" ? "warning" : "info",
          data: {
            id: e.id,
            outcome: e.outcome,
            latencyMs: e.latencyMs,
            chain: finish?.chain,
            method: finish?.method,
          },
        });
        break;
      }
      case "result": {
        const finish = takeFinish(e.id);
        emitBreadcrumb({
          category: "bridge.result",
          level: e.ok ? "info" : "error",
          data: {
            id: e.id,
            ok: e.ok,
            errorCode: e.error?.code,
            durationMs: finish?.durationMs,
            method: finish?.method,
            chain: finish?.chain,
            legacy:
              (finish && SUI_LEGACY_METHODS.has(finish.method)) || undefined,
          },
        });
        break;
      }
      case "navigate":
        emitBreadcrumb({
          category: "bridge.navigate",
          level: "info",
          data: { url: e.url, title: e.title },
        });
        break;
    }
  },
};

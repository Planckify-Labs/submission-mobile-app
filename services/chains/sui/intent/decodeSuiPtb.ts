/**
 * Decode a base64 PTB into the `SuiDecodedCommand[]` structural view the
 * preview renders (spec §4.3). Same output shape as the dApp-bridge's
 * `SuiPtbDecoderInspector` — a compact, self-contained copy so the intent
 * layer doesn't depend on the bridge module. Covers the command kinds the
 * compiler's PTBs emit (MoveCall / SplitCoins / MergeCoins /
 * TransferObjects / MakeMoveVec); unknown kinds are dropped, never shown as
 * a placeholder.
 */

import { fromBase64 } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiDecodedCommand } from "../payloads";

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function argIndex(v: unknown): number {
  const o = v as { Input?: number; index?: number } | undefined;
  if (typeof o?.Input === "number") return o.Input;
  if (typeof o?.index === "number") return o.index;
  return -1;
}

function decodeCommand(c: unknown): SuiDecodedCommand | null {
  if (!c || typeof c !== "object") return null;
  const obj = c as Record<string, unknown> & { $kind?: string; kind?: string };
  const kind = (obj.$kind ?? obj.kind) as string | undefined;
  if (!kind) return null;
  const inner = (obj[kind] ?? obj) as Record<string, unknown>;

  switch (kind) {
    case "MoveCall": {
      let pkg = inner.package as string | undefined;
      let mod = inner.module as string | undefined;
      let fn = inner.function as string | undefined;
      const target = (inner.target ?? obj.target) as string | undefined;
      if (
        (!pkg || !mod || !fn) &&
        typeof target === "string" &&
        target.includes("::")
      ) {
        const [p, m, f] = target.split("::");
        pkg = p;
        mod = m;
        fn = f;
      }
      if (!pkg || !mod || !fn) return null;
      return {
        kind: "MoveCall",
        package: pkg,
        module: mod,
        function: fn,
        argumentCount: asArray(inner.arguments).length,
        typeArgumentCount: asArray(inner.typeArguments ?? inner.type_arguments)
          .length,
      };
    }
    case "TransferObjects":
      return {
        kind: "TransferObjects",
        recipientArgIndex: argIndex(inner.address ?? inner.recipient),
        objectArgCount: asArray(inner.objects).length,
      };
    case "SplitCoins":
      return {
        kind: "SplitCoins",
        sourceArgIndex: argIndex(inner.coin),
        amountCount: asArray(inner.amounts).length,
      };
    case "MergeCoins":
      return {
        kind: "MergeCoins",
        targetArgIndex: argIndex(inner.destination),
        sourceArgCount: asArray(inner.sources).length,
      };
    case "MakeMoveVec":
      return {
        kind: "MakeMoveVec",
        type: typeof inner.type === "string" ? inner.type : undefined,
        elements: asArray(inner.elements).length,
      };
    default:
      return null;
  }
}

export function decodeSuiPtb(ptbBase64: string): SuiDecodedCommand[] {
  let data: Record<string, unknown> | undefined;
  try {
    const tx = Transaction.from(fromBase64(ptbBase64));
    data = (
      tx as unknown as { getData?: () => Record<string, unknown> }
    ).getData?.();
  } catch {
    return [];
  }
  if (!data) return [];
  const raw = (data.commands ?? data.transactions) as unknown[] | undefined;
  const out: SuiDecodedCommand[] = [];
  for (const c of asArray(raw)) {
    const decoded = decodeCommand(c);
    if (decoded) out.push(decoded);
  }
  return out;
}

/**
 * Sui PTB decoder inspector — pure decode, no RPC.
 *
 * Calls `Transaction.from(base64ToBytes(payload.transaction))` and walks
 * `tx.getData()` (or the legacy `tx.blockData.transactions` shape) to
 * patch the intent payload with structural fields:
 *   - `decoded: SuiDecodedCommand[]`
 *   - `sender`, `gasOwner`, `gasBudget`, `gasPrice`, `inputArgumentCount`
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §8.1.
 *
 * Runs at priority 15 (matches `SolanaProgramDecoderInspector`) so the
 * simulation inspector at priority 20 can consume the structural fields
 * when emitting warnings.
 *
 * SDK shape compatibility: the Mysten SDK changed the decoded shape
 * between minor versions (`tx.getData().commands` vs
 * `tx.blockData.transactions`). The decoder handles both shapes via a
 * thin shim — task 00 in `docs/sui-dapp-bridge-task/` verifies the
 * pinned version's shape on the WebView WebKit/Chromium runtime.
 */

import { Transaction } from "@mysten/sui/transactions";

import type {
  SuiDecodedCommand,
  SuiSignTxPayload,
} from "@/services/chains/sui/payloads";
import type { ApprovalIntent } from "../approval";
import type { IntentAnnotation, IntentInspector } from "../inspector";

// Threshold: 0.1 SUI in MIST. Any tx requesting more than this raises an
// info-level annotation. Tunable in review.
const HIGH_GAS_BUDGET_MIST = 100_000_000n;
const SUI_FRAMEWORK_PACKAGE = "0x2";

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

interface DecodedTx {
  sender?: string;
  gasOwner?: string;
  gasBudget?: bigint;
  gasPrice?: bigint;
  inputArgumentCount?: number;
  commands: SuiDecodedCommand[];
}

function asBigInt(v: unknown): bigint | undefined {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  return undefined;
}

/**
 * Decode a single command shape into our `SuiDecodedCommand` union.
 * Defensive — accepts either the new `{ $kind, MoveCall: {...} }` shape
 * or the legacy `{ kind: "MoveCall", target, arguments, ... }` shape.
 * Returns null when the kind isn't recognised — the caller drops the
 * row rather than emitting a `kind: "unknown"` placeholder.
 */
function decodeCommand(c: unknown): SuiDecodedCommand | null {
  if (!c || typeof c !== "object") return null;
  const obj = c as Record<string, unknown> & {
    $kind?: string;
    kind?: string;
  };
  const kind = (obj.$kind ?? obj.kind) as string | undefined;
  if (!kind) return null;

  const inner = (obj[kind] ?? obj) as Record<string, unknown>;

  switch (kind) {
    case "MoveCall": {
      // New shape: { target: "pkg::module::function", arguments: [...], typeArguments: [...] }
      // or split fields: { package, module, function }.
      let pkg: string | undefined;
      let mod: string | undefined;
      let fn: string | undefined;
      const target = (inner.target ?? obj.target) as string | undefined;
      if (typeof target === "string" && target.includes("::")) {
        const [p, m, f] = target.split("::");
        pkg = p;
        mod = m;
        fn = f;
      } else {
        pkg = (inner.package ?? obj.package) as string | undefined;
        mod = (inner.module ?? obj.module) as string | undefined;
        fn = (inner.function ?? obj.function) as string | undefined;
      }
      const args = (inner.arguments ?? obj.arguments) as unknown[] | undefined;
      const typeArgs = (inner.typeArguments ??
        inner.type_arguments ??
        obj.typeArguments) as unknown[] | undefined;
      if (!pkg || !mod || !fn) return null;
      return {
        kind: "MoveCall",
        package: pkg,
        module: mod,
        function: fn,
        argumentCount: Array.isArray(args) ? args.length : 0,
        typeArgumentCount: Array.isArray(typeArgs) ? typeArgs.length : 0,
      };
    }
    case "TransferObjects": {
      const objects = (inner.objects ?? obj.objects) as unknown[] | undefined;
      const addr = (inner.address ?? inner.recipient ?? obj.address) as
        | { Input?: number; index?: number }
        | undefined;
      return {
        kind: "TransferObjects",
        recipientArgIndex:
          typeof addr?.Input === "number"
            ? addr.Input
            : typeof addr?.index === "number"
              ? addr.index
              : -1,
        objectArgCount: Array.isArray(objects) ? objects.length : 0,
      };
    }
    case "SplitCoins": {
      const coin = (inner.coin ?? obj.coin) as
        | { Input?: number; index?: number }
        | undefined;
      const amounts = (inner.amounts ?? obj.amounts) as unknown[] | undefined;
      return {
        kind: "SplitCoins",
        sourceArgIndex:
          typeof coin?.Input === "number"
            ? coin.Input
            : typeof coin?.index === "number"
              ? coin.index
              : -1,
        amountCount: Array.isArray(amounts) ? amounts.length : 0,
      };
    }
    case "MergeCoins": {
      const dest = (inner.destination ?? obj.destination) as
        | { Input?: number; index?: number }
        | undefined;
      const sources = (inner.sources ?? obj.sources) as unknown[] | undefined;
      return {
        kind: "MergeCoins",
        targetArgIndex:
          typeof dest?.Input === "number"
            ? dest.Input
            : typeof dest?.index === "number"
              ? dest.index
              : -1,
        sourceArgCount: Array.isArray(sources) ? sources.length : 0,
      };
    }
    case "Publish": {
      const modules = (inner.modules ?? obj.modules) as unknown[] | undefined;
      const deps = (inner.dependencies ?? obj.dependencies) as
        | unknown[]
        | undefined;
      return {
        kind: "Publish",
        modules: Array.isArray(modules) ? modules.length : 0,
        dependencies: Array.isArray(deps) ? deps.length : 0,
      };
    }
    case "Upgrade": {
      const modules = (inner.modules ?? obj.modules) as unknown[] | undefined;
      const deps = (inner.dependencies ?? obj.dependencies) as
        | unknown[]
        | undefined;
      return {
        kind: "Upgrade",
        modules: Array.isArray(modules) ? modules.length : 0,
        dependencies: Array.isArray(deps) ? deps.length : 0,
      };
    }
    case "MakeMoveVec": {
      const type = (inner.type ?? obj.type) as string | undefined;
      const elements = (inner.elements ?? obj.elements) as
        | unknown[]
        | undefined;
      return {
        kind: "MakeMoveVec",
        type,
        elements: Array.isArray(elements) ? elements.length : 0,
      };
    }
    default:
      return null;
  }
}

function decodeFromBcs(bytes: Uint8Array): DecodedTx | null {
  let tx: ReturnType<typeof Transaction.from>;
  try {
    tx = Transaction.from(bytes);
  } catch {
    return null;
  }

  // Try `tx.getData()` first (current Mysten shape).
  let data: Record<string, unknown> | undefined;
  try {
    const d = (
      tx as unknown as { getData?: () => Record<string, unknown> }
    ).getData?.();
    if (d) data = d;
  } catch {
    // ignore — fall back to `blockData`
  }

  // Legacy fallback: `tx.blockData.transactions`.
  if (!data) {
    const blockData = (tx as unknown as { blockData?: Record<string, unknown> })
      .blockData;
    if (blockData) {
      data = {
        commands: blockData.transactions,
        inputs: blockData.inputs,
        sender: blockData.sender,
        gasData: blockData.gasConfig ?? blockData.gasData,
      };
    }
  }
  if (!data) return null;

  const rawCommands = (data.commands ?? data.transactions) as
    | unknown[]
    | undefined;
  const commands: SuiDecodedCommand[] = [];
  if (Array.isArray(rawCommands)) {
    for (const c of rawCommands) {
      const decoded = decodeCommand(c);
      if (decoded) commands.push(decoded);
    }
  }

  const inputs = (data.inputs ?? []) as unknown[];
  const gasData = (data.gasData ?? {}) as Record<string, unknown>;

  return {
    sender:
      typeof data.sender === "string" ? (data.sender as string) : undefined,
    gasOwner:
      typeof gasData.owner === "string" ? (gasData.owner as string) : undefined,
    gasBudget: asBigInt(gasData.budget),
    gasPrice: asBigInt(gasData.price),
    inputArgumentCount: Array.isArray(inputs) ? inputs.length : undefined,
    commands,
  };
}

export const SuiPtbDecoderInspector: IntentInspector = {
  name: "sui-ptb-decoder",
  priority: 15,
  mode: "auto",
  namespaces: ["sui"],
  async inspect(intent: ApprovalIntent) {
    if (intent.kind !== "signTransaction") {
      return { annotations: [], verdict: "allow" };
    }
    const payload = intent.payload as SuiSignTxPayload;
    if (!payload.transaction) {
      return { annotations: [], verdict: "allow" };
    }
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(payload.transaction);
    } catch {
      return { annotations: [], verdict: "allow" };
    }
    const decoded = decodeFromBcs(bytes);
    if (!decoded) {
      return { annotations: [], verdict: "allow" };
    }

    const annotations: IntentAnnotation[] = [];

    if (
      payload.address &&
      decoded.sender &&
      payload.address.toLowerCase() !== decoded.sender.toLowerCase()
    ) {
      annotations.push({
        code: "decoder.sender.mismatch",
        severity: "warn",
        title: "Sender address mismatch",
        detail: `The transaction's sender (${decoded.sender}) does not match the connected wallet (${payload.address}).`,
        source: "sui-ptb-decoder",
      });
    }

    if (
      decoded.gasBudget !== undefined &&
      decoded.gasBudget > HIGH_GAS_BUDGET_MIST
    ) {
      annotations.push({
        code: "decoder.gas.high-budget",
        severity: "warn",
        title: "High gas budget",
        detail: `Gas budget is ${decoded.gasBudget.toString()} MIST (> 0.1 SUI).`,
        source: "sui-ptb-decoder",
      });
    }

    if (
      decoded.commands.some((c) => c.kind === "Publish" || c.kind === "Upgrade")
    ) {
      annotations.push({
        code: "decoder.publish-or-upgrade",
        severity: "info",
        title: "Publishes or upgrades a Move package",
        detail:
          "This transaction publishes a new Move package or upgrades an existing one. Only proceed if you understand the package being deployed.",
        source: "sui-ptb-decoder",
      });
    }

    for (const c of decoded.commands) {
      if (c.kind === "MoveCall" && c.package !== SUI_FRAMEWORK_PACKAGE) {
        annotations.push({
          code: "decoder.move-call.foreign-package",
          severity: "info",
          title: `MoveCall to package ${c.package}`,
          detail: `${c.package}::${c.module}::${c.function}`,
          source: "sui-ptb-decoder",
        });
        // One annotation per intent regardless of how many foreign-pkg
        // calls there are — the sheet renders the full decoded list
        // anyway.
        break;
      }
    }

    return {
      annotations,
      verdict: "allow",
      patch: {
        ...(payload as object),
        decoded: decoded.commands,
        sender: decoded.sender,
        gasOwner: decoded.gasOwner,
        gasBudget: decoded.gasBudget,
        gasPrice: decoded.gasPrice,
        inputArgumentCount: decoded.inputArgumentCount,
      } as Partial<ApprovalIntent["payload"]>,
    };
  },
};

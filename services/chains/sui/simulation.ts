/**
 * Sui simulation helper — wraps `client.dryRunTransactionBlock` and
 * lifts the response into our `SuiSimulationSummary` shape (bigints
 * preserved at this layer).
 *
 * Spec reference: `docs/sui-dapp-bridge-spec.md` §8.2.
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

import type { SuiSimulationSummary, SuiSimulationWarning } from "./payloads";

/**
 * Local alias — keep the simulation surface chain-agnostic at the type
 * level so a future swap from JSON-RPC to gRPC core client is a one-line
 * import change.
 */
export type SuiSimulationClient = SuiJsonRpcClient;

function asBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    try {
      return BigInt(v);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export async function simulateSuiTransaction(
  client: SuiSimulationClient,
  args: {
    txBase64: string;
    /** Sender address — used to flag balance changes whose owner ≠ sender. */
    sender?: string;
  },
): Promise<SuiSimulationSummary | null> {
  let res: Awaited<ReturnType<SuiSimulationClient["dryRunTransactionBlock"]>>;
  try {
    res = await client.dryRunTransactionBlock({
      transactionBlock: args.txBase64,
    });
  } catch {
    return null;
  }

  const effects = (res.effects ?? {}) as unknown as Record<string, unknown> & {
    status?: { status?: string; error?: string };
    gasUsed?: Record<string, unknown>;
  };
  const statusObj = effects.status ?? {};
  const status: SuiSimulationSummary["status"] =
    statusObj.status === "success"
      ? "success"
      : (statusObj.error ?? statusObj.status ?? "failure");

  const gasUsed = (effects.gasUsed ?? {}) as Record<string, unknown>;

  const balanceChanges: SuiSimulationSummary["balanceChanges"] = (
    res.balanceChanges ?? []
  ).map(
    (b: {
      owner?: unknown;
      coinType: string;
      amount: string | number | bigint;
    }) => {
      const owner = (b.owner ?? "") as
        | string
        | { AddressOwner?: string; ObjectOwner?: string };
      return {
        owner:
          typeof owner === "string"
            ? owner
            : (owner.AddressOwner ?? owner.ObjectOwner ?? ""),
        coinType: b.coinType,
        amount: asBigInt(b.amount),
      };
    },
  );

  const objectChanges: SuiSimulationSummary["objectChanges"] = (
    res.objectChanges ?? []
  ).map((o: unknown) => {
    const obj = o as Record<string, unknown> & {
      type?: string;
      objectId?: string;
      objectType?: string;
      recipient?: string | { AddressOwner?: string; ObjectOwner?: string };
    };
    const kindRaw = (obj.type ?? "") as string;
    const kind: "created" | "mutated" | "transferred" | "deleted" =
      kindRaw === "deleted" ||
      kindRaw === "created" ||
      kindRaw === "mutated" ||
      kindRaw === "transferred"
        ? kindRaw
        : "mutated";
    const recipient =
      typeof obj.recipient === "object" && obj.recipient
        ? (obj.recipient.AddressOwner ?? obj.recipient.ObjectOwner ?? undefined)
        : (obj.recipient as string | undefined);
    return {
      kind,
      objectType: obj.objectType,
      objectId: obj.objectId,
      recipient,
    };
  });

  const warnings: SuiSimulationWarning[] = [];

  if (args.sender) {
    for (const b of balanceChanges) {
      if (b.owner === args.sender && b.amount < 0n) {
        warnings.push({
          code: "ownership.transfer-out",
          coinType: b.coinType,
          amount: b.amount,
        });
      }
    }
  }
  for (const o of objectChanges) {
    if (o.kind === "deleted" && o.objectId) {
      warnings.push({ code: "object.delete", objectId: o.objectId });
    }
    if (
      o.kind === "transferred" &&
      args.sender &&
      o.recipient &&
      o.recipient !== args.sender &&
      o.objectType
    ) {
      warnings.push({ code: "object.transfer-out", objectType: o.objectType });
    }
  }

  return {
    status,
    gasUsed: {
      computation: asBigInt(gasUsed.computationCost),
      storage: asBigInt(gasUsed.storageCost),
      storageRebate: asBigInt(gasUsed.storageRebate),
      nonRefundableStorageFee: asBigInt(gasUsed.nonRefundableStorageFee),
    },
    balanceChanges,
    objectChanges,
    warnings,
  };
}

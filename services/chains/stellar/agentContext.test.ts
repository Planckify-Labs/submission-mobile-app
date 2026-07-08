/**
 * Contract tests for `buildAgentContext` — AI-readiness seam per
 * `docs/stellar-dapp-bridge-spec.md` §11.5.1. Mirrors the coverage shape
 * of `services/chains/sui/agentContext.test.ts`.
 */

import { describe, expect, it } from "vitest";

import type { ApprovalIntent } from "@/services/bridge/approval";
import { buildAgentContext } from "./agentContext.ts";
import type {
  StellarApprovalPayload,
  StellarConnectPayload,
  StellarSignMessagePayload,
  StellarSignTransactionPayload,
} from "./payloads.ts";

function mkIntent<P extends StellarApprovalPayload>(
  kind: ApprovalIntent["kind"],
  payload: P,
  annotations: ApprovalIntent["annotations"] = [],
): ApprovalIntent<P> {
  return {
    id: "intent-1",
    namespace: "stellar",
    kind,
    origin: {
      url: "https://app.soroswap.finance/swap",
      title: "Soroswap",
      via: "webview",
    },
    wallet: null,
    payload,
    annotations,
    createdAt: 0,
  };
}

describe("buildAgentContext — connect", () => {
  it("carries the network and origin host", () => {
    const intent = mkIntent<StellarConnectPayload & { kind: "connect" }>(
      "connect",
      { kind: "connect", network: "mainnet" },
    );
    const ctx = buildAgentContext(intent);
    expect(ctx.namespace).toBe("stellar");
    expect(ctx.origin.host).toBe("app.soroswap.finance");
    expect(ctx.intent).toEqual({ kind: "connect", network: "mainnet" });
  });
});

describe("buildAgentContext — signMessage", () => {
  it("truncates the message to a 16-char preview, keeps the real length", () => {
    const longMessage = "the quick brown fox jumps over the lazy dog";
    const intent = mkIntent<
      StellarSignMessagePayload & { kind: "signMessage" }
    >("signMessage", {
      kind: "signMessage",
      address: "GADDRESS",
      message: longMessage,
    });
    const ctx = buildAgentContext(intent);
    expect(ctx.intent).toMatchObject({
      kind: "signMessage",
      address: "GADDRESS",
      messageLength: longMessage.length,
    });
    if (ctx.intent.kind === "signMessage") {
      expect(ctx.intent.messagePreview.length).toBeLessThanOrEqual(16);
      expect(longMessage.startsWith(ctx.intent.messagePreview)).toBe(true);
    }
    expect(JSON.stringify(ctx)).not.toContain(longMessage);
  });
});

describe("buildAgentContext — signTransaction", () => {
  it("never carries the full XDR — only its length", () => {
    const fakeXdr = "A".repeat(500);
    const intent = mkIntent<
      StellarSignTransactionPayload & { kind: "signTransaction" }
    >("signTransaction", {
      kind: "signTransaction",
      address: "GSENDER",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      xdr: fakeXdr,
      decoded: [
        { kind: "payment", destination: "GDEST", asset: "native", amount: "1" },
      ],
      sourceAccount: "GSENDER",
      fee: "100",
      sequence: "42",
    });
    const ctx = buildAgentContext(intent);
    expect(ctx.intent).toMatchObject({
      kind: "signTransaction",
      xdrLength: 500,
      sourceAccount: "GSENDER",
      feeStroops: "100",
      sequence: "42",
      operationCount: 1,
    });
    expect(JSON.stringify(ctx)).not.toContain(fakeXdr);
  });

  it("threads preflight annotations through, and forwards decoded operations", () => {
    const intent = mkIntent<
      StellarSignTransactionPayload & { kind: "signTransaction" }
    >(
      "signTransaction",
      {
        kind: "signTransaction",
        address: "GSENDER",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
        xdr: "AAAA",
        decoded: [
          {
            kind: "payment",
            destination: "GDEST",
            asset: "native",
            amount: "1",
          },
        ],
        preflight: { destinationExists: false },
      },
      [
        {
          code: "destination.unfunded",
          severity: "warn",
          title: "Recipient not yet funded",
          source: "stellar-preflight",
        },
      ],
    );
    const ctx = buildAgentContext(intent);
    expect(ctx.annotations).toHaveLength(1);
    expect(ctx.annotations[0].code).toBe("destination.unfunded");
    if (ctx.intent.kind === "signTransaction") {
      expect(ctx.intent.preflight).toEqual({ destinationExists: false });
      expect(ctx.intent.decoded).toHaveLength(1);
    }
  });

  it("round-trips through JSON.stringify with no bigint/Uint8Array anywhere", () => {
    const intent = mkIntent<
      StellarSignTransactionPayload & { kind: "signTransaction" }
    >("signTransaction", {
      kind: "signTransaction",
      address: "GSENDER",
      networkPassphrase: "Test SDF Network ; September 2015",
      xdr: "AAAA",
      submit: true,
    });
    const ctx = buildAgentContext(intent);
    expect(() => JSON.stringify(ctx)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(ctx));
    expect(roundTripped.namespace).toBe("stellar");
  });
});

describe("buildAgentContext — unknown kind falls back safely", () => {
  it("never throws for an intent kind this namespace doesn't produce", () => {
    const intent = mkIntent("switchChain", {} as StellarApprovalPayload);
    expect(() => buildAgentContext(intent)).not.toThrow();
    const ctx = buildAgentContext(intent);
    expect(ctx.intent).toEqual({ kind: "unknown" });
  });
});

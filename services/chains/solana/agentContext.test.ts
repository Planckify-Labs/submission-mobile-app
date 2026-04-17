/**
 * Locks down the shape the Takumi AI on-demand inspector sees when the
 * user taps "Ask Takumi AI to review" on a Solana intent. Parity with
 * what the EVM path exposes — structure preserved, secrets stripped.
 *
 * Run:
 *   node --test --experimental-strip-types services/chains/solana/agentContext.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAgentContext } from "./agentContext.ts";
import type { ApprovalIntent } from "../../bridge/approval.ts";
import type {
  SolanaSignInPayload,
  SolanaSignMessagePayload,
  SolanaSignTxPayload,
  SolanaWatchTokenPayload,
} from "./payloads.ts";

function baseIntent<K extends ApprovalIntent["kind"], P>(
  kind: K,
  payload: P,
): ApprovalIntent {
  return {
    id: "req-1",
    namespace: "solana",
    kind,
    origin: {
      url: "https://example.com/app",
      title: "Example",
    },
    wallet: null,
    payload: payload as ApprovalIntent["payload"],
    annotations: [],
    createdAt: 0,
  };
}

describe("buildAgentContext — structural parity with EVM", () => {
  it("connect intent — cluster + silent flag", () => {
    const ctx = buildAgentContext(
      baseIntent("connect", { cluster: "devnet", onlyIfTrusted: true }),
    );
    assert.equal(ctx.namespace, "solana");
    assert.equal(ctx.origin.host, "example.com");
    assert.equal(
      (ctx.intent as { kind: string; cluster: string; onlyIfTrusted: boolean })
        .cluster,
      "devnet",
    );
    assert.equal(
      (ctx.intent as { onlyIfTrusted: boolean }).onlyIfTrusted,
      true,
    );
  });

  it("signIn intent — canonical message from patched payload", () => {
    const p: SolanaSignInPayload & { message: string } = {
      domain: "example.com",
      address: "9xyz",
      nonce: "abc",
      message: "example.com wants you to sign in…",
    };
    const ctx = buildAgentContext(baseIntent("signIn", p));
    const i = ctx.intent as { canonicalMessage?: string; domain: string };
    assert.equal(i.domain, "example.com");
    assert.ok(i.canonicalMessage?.startsWith("example.com wants"));
  });

  it("signMessage intent — preview clamped to 16 chars; full message NOT exposed", () => {
    const msg = "this is a very long sensitive message body";
    const p: SolanaSignMessagePayload = {
      address: "9xyz",
      message: msg,
      display: "utf8",
    };
    const ctx = buildAgentContext(baseIntent("signMessage", p));
    const i = ctx.intent as {
      messageLength: number;
      messagePreview?: string;
    };
    assert.equal(i.messageLength, msg.length);
    assert.equal(i.messagePreview?.length ?? 0, 16);
    // Full message must not leak through any field of the ctx.
    assert.ok(
      !JSON.stringify(ctx).includes("sensitive message body"),
      "full body leaked",
    );
  });

  it("signMessage intent — base64 path omits preview entirely", () => {
    const ctx = buildAgentContext(
      baseIntent("signMessage", {
        address: "9xyz",
        message: "ZGVhZGJlZWY=",
        display: "base64",
      } as SolanaSignMessagePayload),
    );
    const i = ctx.intent as { messagePreview?: string };
    assert.equal(i.messagePreview, undefined);
  });

  it("signTransaction intent — exposes decoder + simulation structure", () => {
    const p: SolanaSignTxPayload = {
      mode: "sign-and-send",
      address: "9xyz",
      cluster: "mainnet-beta",
      version: 0,
      transaction: "AAAA",
      feePayer: "9xyz",
      signerAddresses: ["9xyz", "OTHER"],
      writableAddresses: ["9xyz"],
      decoded: [
        {
          program: "compute-budget",
          kind: "setComputeUnitLimit",
          value: 200000,
        },
        {
          program: "compute-budget",
          kind: "setComputeUnitPrice",
          value: 5000,
        },
        {
          program: "system",
          kind: "transfer",
          data: { from: "9xyz", to: "ABC", lamports: 1_000_000n },
        },
      ],
      simulation: {
        unitsConsumed: 42_000,
        balanceChanges: [{ address: "9xyz", lamportsDelta: -1_001_000n }],
        tokenChanges: [],
        warnings: [],
        logs: ["Program 11111111 invoke [1]"],
      },
    };
    const ctx = buildAgentContext(baseIntent("signTransaction", p));
    const i = ctx.intent as {
      feePayer: string;
      decoded: Array<{ program: string; kind: string; summary?: string }>;
      simulation?: {
        unitsConsumed?: number;
        balanceChangeCount: number;
        logLineCount: number;
      };
      computeBudget?: {
        unitLimit?: number;
        unitPriceMicroLamports?: number;
        priorityFeeLamportsEst?: number;
      };
    };
    assert.equal(i.feePayer, "9xyz");
    assert.equal(i.decoded.length, 3);
    assert.equal(i.simulation?.unitsConsumed, 42_000);
    assert.equal(i.simulation?.balanceChangeCount, 1);
    assert.equal(i.computeBudget?.unitLimit, 200000);
    assert.equal(i.computeBudget?.unitPriceMicroLamports, 5000);
    // ceil(200000 * 5000 / 1_000_000) = 1000
    assert.equal(i.computeBudget?.priorityFeeLamportsEst, 1000);
  });

  it("signTransaction intent — JSON.stringify is safe (no bigints leak)", () => {
    const p: SolanaSignTxPayload = {
      mode: "sign-only",
      address: "9xyz",
      cluster: "mainnet-beta",
      version: 0,
      transaction: "AAAA",
      decoded: [],
      simulation: {
        unitsConsumed: 100,
        balanceChanges: [],
        tokenChanges: [],
        warnings: [],
        logs: [],
      },
    };
    const ctx = buildAgentContext(baseIntent("signTransaction", p));
    // No bigints in the final shape — safe to ship to agent HTTP API.
    assert.doesNotThrow(() => JSON.stringify(ctx));
  });

  it("watchAsset intent — verified on-chain data preserved, claimed separated", () => {
    const p: SolanaWatchTokenPayload = {
      mint: "So1111",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      tokenStandard: "spl-token",
      verified: { mintOwner: "token-2022", extensions: ["TransferFeeConfig"] },
    };
    const ctx = buildAgentContext(baseIntent("watchAsset", p));
    const i = ctx.intent as {
      claimed: { symbol?: string };
      verified?: { mintOwner: string; extensions?: string[] };
    };
    assert.equal(i.claimed.symbol, "USDC");
    assert.equal(i.verified?.mintOwner, "token-2022");
    assert.deepEqual(i.verified?.extensions, ["TransferFeeConfig"]);
  });

  it("annotations forwarded verbatim (source preserved)", () => {
    const intent = baseIntent("connect", {
      cluster: "mainnet-beta",
      onlyIfTrusted: false,
    });
    intent.annotations = [
      {
        code: "origin.insecure",
        severity: "info",
        title: "Insecure origin",
        detail: "http://",
        source: "https",
      },
      {
        code: "siws.domain-mismatch",
        severity: "danger",
        title: "Domain mismatch",
        source: "local",
      },
    ];
    const ctx = buildAgentContext(intent);
    assert.equal(ctx.annotations.length, 2);
    assert.equal(ctx.annotations[1].severity, "danger");
    assert.equal(ctx.annotations[0].source, "https");
  });
});

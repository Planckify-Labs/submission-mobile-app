/**
 * Unit tests for `StellarPreflightInspector`, mocking the global `fetch`
 * that `getHorizonClient`'s `loadAccount` uses — same "mocked Horizon
 * client" test-double shape `accountState.test.ts`/`trustlineService.test.ts`
 * already establish (`docs/stellar-chain-support-spec.md` §9), applied
 * at the transport layer since this inspector resolves its own client
 * internally rather than taking one as a dependency.
 *
 * Spec reference: `docs/stellar-dapp-bridge-spec.md` §8.2, §12.
 */

import { Networks } from "@stellar/stellar-base";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApprovalIntent } from "@/services/bridge/approval";
import type { StellarSignTransactionPayload } from "@/services/chains/stellar/payloads";
import { StellarPreflightInspector } from "./StellarPreflightInspector";

const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function mkIntent(
  payload: StellarSignTransactionPayload,
): ApprovalIntent<StellarSignTransactionPayload> {
  return {
    id: "id",
    namespace: "stellar",
    kind: "signTransaction",
    origin: { url: "https://example.dapp" },
    wallet: null,
    payload,
    annotations: [],
    createdAt: 0,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("StellarPreflightInspector", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("annotates destination.unfunded on a Horizon 404", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({}, 404),
    ) as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
      decoded: [
        { kind: "payment", destination: "GDEST", asset: "native", amount: "1" },
      ],
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations.some((a) => a.code === "destination.unfunded")).toBe(
      true,
    );
    const patch = r.patch as StellarSignTransactionPayload;
    expect(patch.preflight).toEqual({ destinationExists: false });
  });

  it("no annotation for a funded destination + native asset", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        account_id: "GDEST",
        sequence: "1",
        subentry_count: 0,
        balances: [],
      }),
    ) as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
      decoded: [
        { kind: "payment", destination: "GDEST", asset: "native", amount: "1" },
      ],
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations).toEqual([]);
    const patch = r.patch as StellarSignTransactionPayload;
    expect(patch.preflight).toEqual({ destinationExists: true });
  });

  it("annotates destination.no-trustline when the recipient hasn't opted in", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        account_id: "GDEST",
        sequence: "1",
        subentry_count: 0,
        balances: [],
      }),
    ) as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
      decoded: [
        {
          kind: "payment",
          destination: "GDEST",
          asset: `USDC:${USDC_ISSUER}`,
          amount: "1",
        },
      ],
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(
      r.annotations.some((a) => a.code === "destination.no-trustline"),
    ).toBe(true);
    const patch = r.patch as StellarSignTransactionPayload;
    expect(patch.preflight).toEqual({
      destinationExists: true,
      destinationHasTrustline: false,
    });
  });

  it("no annotation when the recipient already trusts the asset", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        account_id: "GDEST",
        sequence: "1",
        subentry_count: 1,
        balances: [
          {
            asset_type: "credit_alphanum4",
            balance: "0",
            asset_code: "USDC",
            asset_issuer: USDC_ISSUER,
          },
        ],
      }),
    ) as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
      decoded: [
        {
          kind: "payment",
          destination: "GDEST",
          asset: `USDC:${USDC_ISSUER}`,
          amount: "1",
        },
      ],
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations).toEqual([]);
    const patch = r.patch as StellarSignTransactionPayload;
    expect(patch.preflight).toEqual({
      destinationExists: true,
      destinationHasTrustline: true,
    });
  });

  it("skips silently (no annotation, no patch) on a non-404 Horizon error", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({}, 500),
    ) as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
      decoded: [
        { kind: "payment", destination: "GDEST", asset: "native", amount: "1" },
      ],
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations).toEqual([]);
    expect(r.patch).toBeUndefined();
  });

  it("does not preflight multi-payment batches (§8.2)", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
      decoded: [
        {
          kind: "payment",
          destination: "GDEST1",
          asset: "native",
          amount: "1",
        },
        {
          kind: "payment",
          destination: "GDEST2",
          asset: "native",
          amount: "1",
        },
      ],
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips when the decoder hasn't patched `decoded` yet", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const intent = mkIntent({
      address: "GSENDER",
      networkPassphrase: Networks.PUBLIC,
      xdr: "unused",
    });
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores non-signTransaction intents", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const intent: ApprovalIntent = {
      id: "id",
      namespace: "stellar",
      kind: "connect",
      origin: { url: "https://example.dapp" },
      wallet: null,
      payload: {},
      annotations: [],
      createdAt: 0,
    };
    const r = await StellarPreflightInspector.inspect(
      intent,
      [],
      new AbortController().signal,
    );
    expect(r.annotations).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("metadata matches spec §8 (priority 20, auto mode, stellar-only)", () => {
    expect(StellarPreflightInspector.priority).toBe(20);
    expect(StellarPreflightInspector.mode).toBe("auto");
    expect(StellarPreflightInspector.namespaces).toEqual(["stellar"]);
  });
});

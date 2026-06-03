/**
 * Unit tests for `parseX402Erc7710Challenge` (spec Phase 5 §8 — challenge
 * parsing). Run under `node:test` via `pnpm test:node`.
 */

import { strict as a } from "node:assert";
import { test } from "node:test";
import {
  parseX402Erc7710Challenge,
  tryParseAcceptEntry,
} from "./parseX402Erc7710Challenge.ts";

const RESOURCE = "https://seller.example/api/v1/pool-safety";

function challengeBody(overrides: Record<string, unknown> = {}) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        price: "$0.02",
        network: "eip155:84532",
        payTo: "0x000000000000000000000000000000000000dEaD",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        resource: RESOURCE,
        maxAmountRequired: "20000",
        extra: { assetTransferMethod: "erc7710" },
        facilitator: "https://facilitator.example/x402",
        ...overrides,
      },
    ],
  };
}

test("extracts a complete erc7710 challenge from the JSON body", async () => {
  const res = new Response(JSON.stringify(challengeBody()), { status: 402 });
  const parsed = await parseX402Erc7710Challenge(res, RESOURCE);
  a.ok(parsed);
  a.equal(parsed?.scheme, "exact");
  a.equal(parsed?.network, "eip155:84532");
  a.equal(parsed?.maxAmountRequired, "20000");
  a.equal(parsed?.payTo, "0x000000000000000000000000000000000000dEaD");
  a.equal(parsed?.asset, "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  a.equal(parsed?.assetTransferMethod, "erc7710");
  a.equal(parsed?.facilitator, "https://facilitator.example/x402");
});

test("rejects non-exact schemes", async () => {
  const res = new Response(JSON.stringify(challengeBody({ scheme: "upto" })), {
    status: 402,
  });
  a.equal(await parseX402Erc7710Challenge(res, RESOURCE), null);
});

test("rejects entries that aren't the erc7710 transfer method", async () => {
  const body = challengeBody();
  body.accepts[0].extra = { assetTransferMethod: "eip3009" } as never;
  const res = new Response(JSON.stringify(body), { status: 402 });
  a.equal(await parseX402Erc7710Challenge(res, RESOURCE), null);
});

test("accepts assetTransferMethod hoisted to the top level", () => {
  const parsed = tryParseAcceptEntry(
    {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x000000000000000000000000000000000000dEaD",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      maxAmountRequired: 20000,
      assetTransferMethod: "erc7710",
    },
    RESOURCE,
  );
  a.ok(parsed);
  a.equal(parsed?.maxAmountRequired, "20000"); // numbers coerced to string
  a.equal(parsed?.facilitator, null);
});

test("falls back to the header form", async () => {
  const entry = challengeBody().accepts[0];
  const res = new Response(null, {
    status: 402,
    headers: { "payment-required": JSON.stringify(entry) },
  });
  const parsed = await parseX402Erc7710Challenge(res, RESOURCE);
  a.ok(parsed);
  a.equal(parsed?.network, "eip155:84532");
});

test("returns null (never throws) on a body with no recognisable challenge", async () => {
  const res = new Response(JSON.stringify({ error: "nope" }), { status: 402 });
  a.equal(await parseX402Erc7710Challenge(res, RESOURCE), null);
});

test("defaults resource to the fetched URL when omitted", () => {
  const parsed = tryParseAcceptEntry(
    {
      scheme: "exact",
      network: "eip155:84532",
      payTo: "0x000000000000000000000000000000000000dEaD",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      maxAmountRequired: "1",
      extra: { assetTransferMethod: "erc7710" },
    },
    RESOURCE,
  );
  a.equal(parsed?.resource, RESOURCE);
});

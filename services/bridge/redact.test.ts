/**
 * Unit tests for `redactParams`. Ensures sensitive message bodies never
 * reach the BridgeEventBus in plaintext. Invariant §10.4.8.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types services/bridge/redact.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REDACTED_SEED_PLACEHOLDER,
  redactParams,
  scrubLoggerPayload,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "./redact.ts";

describe("redactParams — signing methods", () => {
  it("personal_sign replaces message with {length, sha256Prefix}, preserves address", () => {
    const out = redactParams("personal_sign", [
      "hello from a dApp",
      "0xabc123",
    ]) as [{ length: number; sha256Prefix: string }, string];
    assert.ok(typeof out[0] === "object");
    assert.equal(out[0].length, "hello from a dApp".length);
    assert.match(out[0].sha256Prefix, /^[0-9a-f]+$/);
    assert.equal(out[1], "0xabc123");
  });

  it("eth_sign preserves [address, redacted] order", () => {
    const out = redactParams("eth_sign", ["0xabc", "0xdeadbeef"]) as [
      string,
      { length: number; sha256Prefix: string },
    ];
    assert.equal(out[0], "0xabc");
    assert.ok(typeof out[1] === "object");
  });

  it("redacts every typed-data version", () => {
    for (const m of [
      "eth_signTypedData",
      "eth_signTypedData_v1",
      "eth_signTypedData_v3",
      "eth_signTypedData_v4",
    ]) {
      const out = redactParams(m, [
        "0xabc",
        { domain: { name: "X" }, message: { secret: 1 } },
      ]) as [string, { length: number; sha256Prefix: string }];
      assert.equal(out[0], "0xabc");
      assert.ok(out[1].sha256Prefix);
      // Original nested object must NOT appear as-is.
      assert.ok(!("message" in out[1]));
    }
  });
});

describe("redactParams — send transaction", () => {
  it("truncates calldata to selector only", () => {
    const out = redactParams("eth_sendTransaction", [
      {
        to: "0xrecipient",
        from: "0xsender",
        value: "0x0",
        chainId: "0x1",
        data: "0xa9059cbb000000000000000000000000abcabcabcabcabcabcabcabcabcabcabcabcabcabc",
      },
    ]) as [Record<string, unknown>];
    const r = out[0];
    assert.equal(r.to, "0xrecipient");
    assert.equal(r.from, "0xsender");
    assert.equal(r.chainId, "0x1");
    assert.equal(
      typeof r.dataLength,
      "number",
      "dataLength should be populated",
    );
    assert.ok(
      typeof r.dataSelector === "string" &&
        r.dataSelector.startsWith("0xa9059cbb"),
      "selector preserved as first 10 chars",
    );
  });

  it("leaves tx with short data untouched (data already short)", () => {
    const out = redactParams("eth_sendTransaction", [
      { to: "0xabc", data: "0xaa" },
    ]) as [Record<string, unknown>];
    assert.equal(out[0].dataSelector, "0xaa");
  });

  it("returns params unchanged when tx is non-object", () => {
    const out = redactParams("eth_sendTransaction", [null]);
    assert.deepEqual(out, [null]);
  });
});

describe("redactParams — unknown methods", () => {
  it("pass-through for methods without a redaction rule", () => {
    const p = [123, "abc"];
    assert.deepEqual(redactParams("eth_chainId", p), p);
  });
});

describe("redactParams — solana", () => {
  it("redacts solana:signMessage payloads", () => {
    const out = redactParams("solana:signMessage", ["some secret"]) as [
      { length: number; sha256Prefix: string },
    ];
    assert.ok(out[0].sha256Prefix);
    assert.equal(out[0].length, "some secret".length);
  });
});

describe("scrubLoggerPayload — BIP-39 run detection (TWV-2026-003)", () => {
  const MNEMONIC_12 =
    "abandon ability able about above absent absorb abstract absurd abuse access accident";

  it("redacts a 12-word BIP-39-shape mnemonic in a plain string", () => {
    const out = scrubLoggerPayload(`user seed is ${MNEMONIC_12} please save`);
    assert.match(String(out), /\[REDACTED_SEED\]/);
  });

  it("does NOT redact ordinary prose with <12 words", () => {
    const out = scrubLoggerPayload("hello this is just a short sentence");
    assert.equal(out, "hello this is just a short sentence");
  });

  it("does NOT redact long sentences with mixed-case / punctuation", () => {
    const s =
      "Starting the transaction flow for user on chain 1 with a large batch of 20 different tokens now";
    // Mixed case + numbers break the strict lowercase-alpha gate.
    const out = scrubLoggerPayload(s);
    assert.equal(out, s);
  });

  it("redacts mnemonic embedded inside an object value", () => {
    const out = scrubLoggerPayload({
      event: "signin",
      detail: `pasted: ${MNEMONIC_12}`,
    }) as { event: string; detail: string };
    assert.ok(out.detail.includes(REDACTED_SEED_PLACEHOLDER));
  });

  it("redacts by key name (mnemonic/seed/privateKey)", () => {
    const out = scrubLoggerPayload({
      mnemonic: "whatever value",
      seedPhrase: "x",
      privateKey: "y",
      pk: "z",
    }) as Record<string, unknown>;
    assert.equal(out.mnemonic, REDACTED_SEED_PLACEHOLDER);
    assert.equal(out.seedPhrase, REDACTED_SEED_PLACEHOLDER);
    assert.equal(out.privateKey, REDACTED_SEED_PLACEHOLDER);
    assert.equal(out.pk, REDACTED_SEED_PLACEHOLDER);
  });
});

describe("scrubLoggerPayload — private-key hex detection", () => {
  it("redacts 0x-prefixed 64-hex in any string position", () => {
    const pk = "0x" + "a".repeat(64);
    const out = scrubLoggerPayload(`signing with ${pk} now`);
    assert.match(String(out), /\[REDACTED_SEED\]/);
  });

  it("does NOT redact 0x-prefixed 40-hex (address)", () => {
    const addr = "0x" + "a".repeat(40);
    const out = scrubLoggerPayload(`to=${addr}`);
    assert.equal(out, `to=${addr}`);
  });
});

describe("scrubLoggerPayload — Solana base58 detection", () => {
  it("redacts a 44-char base58 blob", () => {
    // 44 char base58 — 32 bytes encoded.
    const b58 = "5".repeat(44);
    const out = scrubLoggerPayload(`kp=${b58}`);
    assert.match(String(out), /\[REDACTED_SEED\]/);
  });
});

describe("scrubLoggerPayload — structural", () => {
  it("walks arrays and nested objects", () => {
    const m =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const out = scrubLoggerPayload({
      steps: [
        { name: "a", note: "fine" },
        { name: "b", note: `leaked: ${m}` },
      ],
    }) as { steps: Array<{ note: string }> };
    assert.equal(out.steps[0].note, "fine");
    assert.ok(out.steps[1].note.includes(REDACTED_SEED_PLACEHOLDER));
  });

  it("tolerates cycles", () => {
    const a: Record<string, unknown> = { k: 1 };
    a.self = a;
    const out = scrubLoggerPayload(a);
    assert.ok(out);
  });

  it("scrubs Error objects (message + stack)", () => {
    const err = new Error("leaking 0x" + "b".repeat(64) + " in a stack");
    const out = scrubLoggerPayload(err) as { message: string };
    assert.ok(out.message.includes(REDACTED_SEED_PLACEHOLDER));
  });

  it("scrubSentryEvent / Breadcrumb are aliases", () => {
    const pk = "0x" + "c".repeat(64);
    const evt = { message: `pk=${pk}` };
    const redactedEvent = scrubSentryEvent(evt) as { message: string };
    const redactedBr = scrubSentryBreadcrumb(evt) as { message: string };
    assert.ok(redactedEvent.message.includes(REDACTED_SEED_PLACEHOLDER));
    assert.ok(redactedBr.message.includes(REDACTED_SEED_PLACEHOLDER));
  });
});

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
  it("redacts a 64-byte base58 blob (Phantom/Solflare export shape)", () => {
    // ~88 chars — the 64-byte secret-key encoding.
    const b58 = "5".repeat(88);
    const out = scrubLoggerPayload(`kp=${b58}`);
    assert.match(String(out), /\[REDACTED_SEED\]/);
  });

  it("does NOT redact Solana public addresses (~43–44 chars base58)", () => {
    // Real Solana mint addresses (and every public account key) are
    // 32 bytes base58 → 43–44 chars. Same shape as a 32-byte private
    // key, but indistinguishable without context. We rely on KEY_DENY
    // for seed detection instead; addresses in URLs / logs must pass
    // through unchanged.
    const mint = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    const url = `https://raydium.io/swap/?outputMint=${mint}`;
    const out = scrubLoggerPayload(url);
    assert.equal(out, url);
  });

  it("still redacts a raw base58 key placed under a denied object key", () => {
    // Even though the string-level scrubber no longer fires on 32-byte
    // base58, `KEY_DENY` catches it via the object-key path.
    const raw = "5".repeat(44);
    const out = scrubLoggerPayload({ privateKey: raw }) as {
      privateKey: string;
    };
    assert.equal(out.privateKey, REDACTED_SEED_PLACEHOLDER);
  });
});

describe("redactParams — Solana methods (§10.4 inv 11)", () => {
  it("solana:signMessage redacts message body", () => {
    const out = redactParams("solana:signMessage", [
      {
        address: "9xyz",
        chain: "solana:mainnet",
        message: "ZGVhZGJlZWZkZWFkYmVlZmRlYWRiZWVm",
      },
    ]) as [
      {
        address: string;
        chain: string;
        messageLength: number;
        messagePreview: string;
      },
    ];
    assert.equal(out[0].address, "9xyz");
    assert.equal(out[0].chain, "solana:mainnet");
    assert.equal(out[0].messageLength, 32);
    assert.ok(out[0].messagePreview.length <= 17);
    // Full message must not leak.
    assert.ok(
      !JSON.stringify(out).includes("ZGVhZGJlZWZkZWFkYmVlZmRlYWRiZWVm"),
    );
  });

  it("solana:signTransaction drops the base64 tx body", () => {
    const fakeTxBody = "A".repeat(600);
    const out = redactParams("solana:signTransaction", [
      { address: "9xyz", chain: "solana:mainnet", transaction: fakeTxBody },
    ]) as [{ txBytes: number }];
    assert.equal(out[0].txBytes, 600);
    assert.ok(!JSON.stringify(out).includes(fakeTxBody));
  });

  it("solana:signAndSendTransaction drops tx body across batch", () => {
    const fake = "X".repeat(400);
    const out = redactParams("solana:signAndSendTransaction", [
      { address: "9xyz", chain: "solana:devnet", transaction: fake },
    ]) as [{ txBytes: number }];
    assert.equal(out[0].txBytes, 400);
    assert.ok(!JSON.stringify(out).includes(fake));
  });

  it("solana:signIn keeps structural fields, drops signatures", () => {
    const out = redactParams("solana:signIn", [
      {
        domain: "example.com",
        nonce: "abc",
        issuedAt: "2026-01-01T00:00:00Z",
        expirationTime: "2026-01-02T00:00:00Z",
      },
    ]) as [
      {
        domain: string;
        hasNonce: boolean;
        issuedAt: string;
        expirationTime: string;
      },
    ];
    assert.equal(out[0].domain, "example.com");
    assert.equal(out[0].hasNonce, true);
    assert.equal(out[0].issuedAt, "2026-01-01T00:00:00Z");
    // Ensure actual nonce is not emitted.
    assert.ok(!JSON.stringify(out).includes("abc"));
  });

  it("standard:connect redacts to silent flag only", () => {
    const out = redactParams("standard:connect", [{ silent: true }]) as [
      { silent: boolean },
    ];
    assert.equal(out[0].silent, true);
  });

  it("takumi:switchCluster / watchToken pass through (no secrets)", () => {
    const sc = redactParams("takumi:switchCluster", [{ to: "devnet" }]);
    assert.deepEqual(sc, [{ to: "devnet" }]);
    const wt = redactParams("takumi:watchToken", [
      { mint: "So1111111111111111111111111111111111111112" },
    ]);
    assert.deepEqual(wt, [
      { mint: "So1111111111111111111111111111111111111112" },
    ]);
  });
});

describe("redactParams — Sui methods (§11.5.3)", () => {
  it("sui:signPersonalMessage keeps address + lengths only", () => {
    const longMessage = "the secret message body that should never leak";
    const out = redactParams("sui:signPersonalMessage", [
      {
        account: { address: "0xabc" },
        chain: "sui:mainnet",
        message: longMessage,
      },
    ]) as [
      {
        address: string;
        chain: string;
        messageLength: number;
        messagePreview: string;
      },
    ];
    assert.equal(out[0].address, "0xabc");
    assert.equal(out[0].chain, "sui:mainnet");
    assert.equal(out[0].messageLength, longMessage.length);
    assert.ok(out[0].messagePreview.length <= 17, "16-char cap + ellipsis");
    assert.ok(!JSON.stringify(out).includes(longMessage));
  });

  it("sui:signPersonalMessage falls back to top-level address", () => {
    const out = redactParams("sui:signPersonalMessage", [
      { address: "0xdef", message: "x" },
    ]) as [{ address: string }];
    assert.equal(out[0].address, "0xdef");
  });

  for (const method of [
    "sui:signTransaction",
    "sui:signAndExecuteTransaction",
    "sui:signTransactionBlock",
    "sui:signAndExecuteTransactionBlock",
  ]) {
    it(`${method} drops the base64 transaction body`, () => {
      const fakeTx = "T".repeat(900);
      const out = redactParams(method, [
        {
          account: { address: "0xabc" },
          chain: "sui:mainnet",
          transaction: fakeTx,
          options: { showEffects: true },
        },
      ]) as [
        {
          address: string;
          chain: string;
          txBytes: number;
          hasOptions: boolean;
        },
      ];
      assert.equal(out[0].address, "0xabc");
      assert.equal(out[0].chain, "sui:mainnet");
      assert.equal(out[0].txBytes, 900);
      assert.equal(out[0].hasOptions, true);
      assert.ok(!JSON.stringify(out).includes(fakeTx));
    });
  }

  it("sui:reportTransactionEffects logs only effects byte length", () => {
    const fakeEffects = "E".repeat(10_000);
    const out = redactParams("sui:reportTransactionEffects", [
      {
        account: { address: "0xabc" },
        chain: "sui:mainnet",
        effects: fakeEffects,
      },
    ]) as [
      {
        address: string;
        chain: string;
        effectsBytes: number;
      },
    ];
    assert.equal(out[0].address, "0xabc");
    assert.equal(out[0].effectsBytes, 10_000);
    assert.ok(!JSON.stringify(out).includes(fakeEffects));
  });

  it("takumi:switchNetwork passes through (defensive shape snapshot)", () => {
    const out = redactParams("takumi:switchNetwork", [
      { from: "mainnet", to: "testnet" },
    ]);
    assert.deepEqual(out, [{ from: "mainnet", to: "testnet" }]);
    // Snapshot guard: redactor must not invent fields. Any future-added
    // field on this payload should fail this exact deep equal so the
    // reviewer revisits the redaction posture.
  });

  it("standard:connect (universal) handles Sui without changes", () => {
    const out = redactParams("standard:connect", [{ silent: true }]) as [
      { silent: boolean },
    ];
    assert.equal(out[0].silent, true);
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

/**
 * Tests for the signed-push verifier — TWV-2026-054.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/pushSignature.test.ts
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { verifySignedPush } from "./pushSignature.ts";

const KEY_HEX = "0x" + "a".repeat(64); // 32-byte key

function signFor(notificationId: string, deeplink: string, expiresAt: number) {
  const msg = `${notificationId}|${deeplink}|${expiresAt}`;
  const sig = createHmac("sha256", Buffer.from(KEY_HEX.slice(2), "hex"))
    .update(msg)
    .digest("hex");
  return `0x${sig}`;
}

describe("verifySignedPush", () => {
  it("accepts a valid signed push", async () => {
    const expires = Date.now() + 60_000;
    const sig = signFor("notif-1", "https://takumipay.xyz/sign?id=1", expires);
    const v = await verifySignedPush(
      {
        notificationId: "notif-1",
        deeplink: "https://takumipay.xyz/sign?id=1",
        expiresAt: expires,
        signatureHex: sig,
      },
      KEY_HEX,
    );
    assert.equal(v.ok, true);
  });

  it("rejects expired payload", async () => {
    const expires = Date.now() - 1000;
    const sig = signFor("notif-2", "https://takumipay.xyz/sign?id=2", expires);
    const v = await verifySignedPush(
      {
        notificationId: "notif-2",
        deeplink: "https://takumipay.xyz/sign?id=2",
        expiresAt: expires,
        signatureHex: sig,
      },
      KEY_HEX,
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "expired");
  });

  it("rejects bad signature", async () => {
    const expires = Date.now() + 60_000;
    const v = await verifySignedPush(
      {
        notificationId: "notif-3",
        deeplink: "https://takumipay.xyz/sign?id=3",
        expiresAt: expires,
        signatureHex: "0x" + "b".repeat(64),
      },
      KEY_HEX,
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "bad_signature");
  });

  it("rejects missing fields", async () => {
    const v = await verifySignedPush(
      {
        notificationId: "",
        deeplink: "",
        expiresAt: 0,
        signatureHex: "",
      },
      KEY_HEX,
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "missing_fields");
  });
});

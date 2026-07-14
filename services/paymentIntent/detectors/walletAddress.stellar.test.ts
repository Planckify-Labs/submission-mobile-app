/**
 * Tests for `walletAddressStellarDetector` — mirrors
 * `walletAddress.test.ts`'s shape-test style.
 *
 * Run from the mobile-app root with:
 *
 *     node --test --experimental-strip-types \
 *          services/paymentIntent/detectors/walletAddress.stellar.test.ts
 */

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { __resetForTest } from "../detectorRegistry.ts";
import { walletAddressStellarDetector } from "./walletAddress.stellar.ts";

describe("walletAddressStellarDetector", () => {
  beforeEach(() => {
    __resetForTest();
  });

  it("detects a valid StrKey G… address", () => {
    const raw = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    const hit = walletAddressStellarDetector.detect(raw);
    assert.deepEqual(hit, {
      source: "qr",
      channel: {
        kind: "wallet",
        namespace: "stellar",
        address: raw,
        target: undefined,
      },
      rawScan: raw,
    });
  });

  it("handles leading/trailing whitespace on a valid address", () => {
    const addr = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
    const hit = walletAddressStellarDetector.detect(`  ${addr}\n`);
    assert.ok(hit);
    if (hit?.channel.kind === "wallet") {
      assert.equal(hit.channel.address, addr);
    }
  });

  it("rejects a StrKey secret seed (S…)", () => {
    const raw = "SBPTREV4YOF7YHNBEZS3GNRVNK4G5NUHXCEC3NAJEXFYMSTQBCTYVOTG";
    const hit = walletAddressStellarDetector.detect(raw);
    assert.equal(hit, null);
  });

  it("rejects an address with a corrupted checksum", () => {
    const raw = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVM";
    const hit = walletAddressStellarDetector.detect(raw);
    assert.equal(hit, null);
  });

  it("rejects an EVM address", () => {
    const raw = "0xabcdef0123456789abcdef0123456789abcdef01";
    const hit = walletAddressStellarDetector.detect(raw);
    assert.equal(hit, null);
  });

  it("rejects empty and whitespace-only input", () => {
    assert.equal(walletAddressStellarDetector.detect(""), null);
    assert.equal(walletAddressStellarDetector.detect("   "), null);
  });

  it("rejects an arbitrary non-address string", () => {
    assert.equal(walletAddressStellarDetector.detect("hello world"), null);
  });

  it("declares priority 50 (peer to the other bare-address detectors)", () => {
    assert.equal(walletAddressStellarDetector.priority, 50);
    assert.equal(walletAddressStellarDetector.name, "walletAddressStellar");
  });
});

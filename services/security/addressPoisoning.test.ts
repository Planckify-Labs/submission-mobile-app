/**
 * TWV-2026-022 — clipboard-swap detection + middle-window formatter.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/addressPoisoning.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkPoisoning,
  detectClipboardSwap,
  formatAddressMiddleWindow,
} from "./addressPoisoning.ts";

const CONTACT_ADDR = "0x1234abcdef1234abcdef1234abcdef12345678ef";
const SUFFIX = CONTACT_ADDR.slice(-4); // "78ef"
const PREFIX = CONTACT_ADDR.slice(2, 6); // "1234"

function buildLookalike(distance: number): string {
  // Mutate `distance` characters in the middle (positions 10..36 in the
  // hex body, i.e. starting after prefix). Keep prefix and suffix intact.
  const chars = CONTACT_ADDR.split("");
  for (let i = 0; i < distance; i++) {
    const pos = 10 + i; // after "0x1234"
    chars[pos] = chars[pos] === "f" ? "0" : "f";
  }
  return chars.join("");
}

describe("detectClipboardSwap — TWV-2026-022", () => {
  const ctx = {
    contacts: [{ address: CONTACT_ADDR, label: "Vitalik" }],
    recentCounterparties: [],
  };

  it("flags a near-twin (Hamming distance 1)", () => {
    const swap = buildLookalike(1);
    const out = detectClipboardSwap(swap, ctx);
    assert.equal(out.isSwap, true);
    assert.equal(out.similarTo?.address, CONTACT_ADDR);
    assert.equal(out.distance, 1);
  });

  it("flags a 4-char swap (at threshold)", () => {
    const swap = buildLookalike(4);
    const out = detectClipboardSwap(swap, ctx);
    assert.equal(out.isSwap, true);
    assert.equal(out.distance, 4);
  });

  it("does NOT flag a 5-char swap (over threshold)", () => {
    const swap = buildLookalike(5);
    const out = detectClipboardSwap(swap, ctx);
    assert.equal(out.isSwap, false);
  });

  it("does NOT flag the contact's own address", () => {
    const out = detectClipboardSwap(CONTACT_ADDR, ctx);
    assert.equal(out.isSwap, false);
  });

  it("does NOT flag an unrelated address (different prefix/suffix)", () => {
    const other = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const out = detectClipboardSwap(other, ctx);
    assert.equal(out.isSwap, false);
  });

  it("returns isSwap=false for malformed input", () => {
    const out = detectClipboardSwap("not-an-address", ctx);
    assert.equal(out.isSwap, false);
  });

  it("walks recentCounterparties as well as contacts", () => {
    const ctx2 = {
      contacts: [],
      recentCounterparties: [{ address: CONTACT_ADDR, label: "Recent" }],
    };
    const swap = buildLookalike(2);
    const out = detectClipboardSwap(swap, ctx2);
    assert.equal(out.isSwap, true);
  });
});

describe("formatAddressMiddleWindow", () => {
  it("renders prefix·mid4…tailMid4·suffix", () => {
    const out = formatAddressMiddleWindow(CONTACT_ADDR);
    // 0x1234·abcd…3456·78ef
    assert.match(out, /^0x[0-9a-f]{4}·[0-9a-f]{4}…[0-9a-f]{4}·[0-9a-f]{4}$/);
    assert.ok(out.startsWith("0x" + PREFIX));
    assert.ok(out.endsWith("·" + SUFFIX));
  });

  it("returns the original string for malformed input", () => {
    assert.equal(formatAddressMiddleWindow("not-an-address"), "not-an-address");
  });
});

describe("checkPoisoning — pre-existing exact prefix+suffix match", () => {
  it("still works (regression check)", () => {
    const ctx = {
      contacts: [{ address: CONTACT_ADDR }],
      recentCounterparties: [],
    };
    const exact = `0x${PREFIX}deadbeefdeadbeefdeadbeefdeadbeef${SUFFIX}`;
    const out = checkPoisoning(exact, ctx);
    assert.equal(out.isPoisoning, true);
  });
});

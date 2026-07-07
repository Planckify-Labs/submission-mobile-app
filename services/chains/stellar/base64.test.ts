/**
 * Regression guard for the `transaction_malformed` bug: `@stellar/js-xdr`
 * allocates via the ambient global `Buffer`, and whatever `Buffer`
 * resolves to under this app's Hermes runtime doesn't correctly
 * implement `.toString("base64")` — it silently produced a
 * comma-joined decimal byte list instead. `bytesToBase64` (btoa-based)
 * is the fix; these tests pin its correctness against Node's own
 * `Buffer`-based encoder as the independent reference implementation.
 */

import { describe, expect, it } from "vitest";

import { bytesToBase64 } from "./base64.ts";

describe("bytesToBase64", () => {
  it("matches Buffer.toString('base64') for arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 64, 32, 16]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("matches Buffer.toString('base64') for empty input", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe(
      Buffer.from([]).toString("base64"),
    );
  });

  it("matches Buffer.toString('base64') for a single byte", () => {
    expect(bytesToBase64(new Uint8Array([65]))).toBe("QQ==");
  });

  it("never returns a comma-joined decimal list (the bug this guards against)", () => {
    const bytes = new Uint8Array([0, 0, 0, 2, 23, 11, 58, 223]);
    const result = bytesToBase64(bytes);
    expect(result).not.toContain(",");
    expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
  });

  it("round-trips through atob", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const encoded = bytesToBase64(bytes);
    const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("handles a realistic XDR-sized payload (hundreds of bytes)", () => {
    const bytes = new Uint8Array(667);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) % 256;
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

/**
 * Spec reference: `docs/stellar-chain-support-spec.md` §9 (regression
 * guard against the USDC-decimals transcription bug — 7 decimals, not
 * 6 — plus general stroops⇄decimal-string round-tripping).
 */

import { describe, expect, it } from "vitest";

import {
  formatStroopsAsDecimalString,
  parseDecimalStringAsStroops,
} from "./amount.ts";

describe("formatStroopsAsDecimalString", () => {
  it("formats exactly 1 XLM as 1.0000000 (7 decimals)", () => {
    expect(formatStroopsAsDecimalString(10_000_000n)).toBe("1.0000000");
  });

  it("formats 0 stroops as 0.0000000", () => {
    expect(formatStroopsAsDecimalString(0n)).toBe("0.0000000");
  });

  it("formats a sub-unit amount without losing the leading zero", () => {
    expect(formatStroopsAsDecimalString(1n)).toBe("0.0000001");
  });

  it("formats a large amount without precision loss (beyond float-safe range)", () => {
    // 1_234_567_890_123_456_789 stroops — well beyond
    // Number.MAX_SAFE_INTEGER, so a float-based conversion would lose
    // precision; bigint/string arithmetic must not.
    expect(formatStroopsAsDecimalString(1_234_567_890_123_456_789n)).toBe(
      "123456789012.3456789",
    );
  });

  it("formats a negative amount with a leading minus sign", () => {
    expect(formatStroopsAsDecimalString(-10_000_000n)).toBe("-1.0000000");
  });
});

describe("parseDecimalStringAsStroops", () => {
  it("parses 1.0000000 as exactly 1 XLM in stroops", () => {
    expect(parseDecimalStringAsStroops("1.0000000")).toBe(10_000_000n);
  });

  it("parses a Horizon-style balance string with full precision", () => {
    expect(parseDecimalStringAsStroops("194.6552190")).toBe(1_946_552_190n);
  });

  it("parses a whole number with no decimal point", () => {
    expect(parseDecimalStringAsStroops("5")).toBe(50_000_000n);
  });

  it("parses a truncated fractional part by right-padding with zeros", () => {
    expect(parseDecimalStringAsStroops("1.5")).toBe(15_000_000n);
  });

  it("parses zero", () => {
    expect(parseDecimalStringAsStroops("0")).toBe(0n);
    expect(parseDecimalStringAsStroops("0.0000000")).toBe(0n);
  });

  it("round-trips through format for an arbitrary amount", () => {
    const stroops = 9_876_543_210_123n;
    const str = formatStroopsAsDecimalString(stroops);
    expect(parseDecimalStringAsStroops(str)).toBe(stroops);
  });
});

/**
 * Tests for the EIP-7702 authorization guards — TWV-2026-010.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/chains/evm/eip7702Guard.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTHORIZED_DELEGATORS,
  decideAuthorizationByAddress,
  decideAuthorizationByBytecode,
  ZERO_ADDRESS,
} from "./eip7702Guard.ts";

describe("decideAuthorizationByAddress", () => {
  it("allows zero-address (revoke) even though it's not 'on' the allowlist", () => {
    const d = decideAuthorizationByAddress(ZERO_ADDRESS);
    assert.equal(d.ok, true);
  });

  it("rejects an arbitrary delegate not on the allowlist", () => {
    const d = decideAuthorizationByAddress(
      "0x1234567890abcdef1234567890abcdef12345678",
    );
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "not_on_allowlist");
  });

  it("rejects a malformed (non-hex) address", () => {
    const d = decideAuthorizationByAddress("not-an-address");
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "malformed");
  });

  it("is case-insensitive on the allowlist match", () => {
    const allowed = Array.from(AUTHORIZED_DELEGATORS)[0];
    const d = decideAuthorizationByAddress(allowed.toUpperCase());
    assert.equal(d.ok, true);
  });
});

describe("decideAuthorizationByBytecode — SELFDESTRUCT sniff", () => {
  it("allows empty / undefined bytecode (EOA / deferred deploy)", () => {
    assert.equal(decideAuthorizationByBytecode(undefined).ok, true);
    assert.equal(decideAuthorizationByBytecode(null).ok, true);
    assert.equal(decideAuthorizationByBytecode("0x").ok, true);
  });

  it("allows benign bytecode prologue (no 0xff opcode)", () => {
    // PUSH1 0x80 PUSH1 0x40 MSTORE … (typical Solidity prologue, no 0xff).
    const code = ("0x" + "608060405234801561001057600080fd5b") as `0x${string}`;
    assert.equal(decideAuthorizationByBytecode(code).ok, true);
  });

  it("rejects bytecode with SELFDESTRUCT (0xff) in the prologue", () => {
    const code = ("0x" + "6080604052ff5b" + "00".repeat(50)) as `0x${string}`;
    const d = decideAuthorizationByBytecode(code);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "selfdestruct");
  });

  it("only sniffs the first 512 bytes — SELFDESTRUCT past that is allowed", () => {
    const prologue = "60".repeat(512);
    const tail = "ff" + "00".repeat(20);
    const d = decideAuthorizationByBytecode(
      ("0x" + prologue + tail) as `0x${string}`,
    );
    assert.equal(d.ok, true);
  });
});

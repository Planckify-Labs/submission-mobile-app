/**
 * Tests for the scam-domain feed predicate — TWV-2026-051.
 *
 * Run from mobile-app root:
 *   node --test --experimental-strip-types \
 *     services/security/scamDomainFeed.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isFlaggedHost,
  SIGNATURE_PRODUCING_METHODS,
  setFlaggedHosts,
} from "./scamDomainFeed.ts";

describe("isFlaggedHost — fallback list", () => {
  it("flags a host on the embedded fallback list", () => {
    assert.equal(isFlaggedHost("https://uniswap-claim.io/promo"), true);
  });

  it("flags subdomains of a fallback host", () => {
    assert.equal(isFlaggedHost("https://drop.uniswap-claim.io/"), true);
  });

  it("does NOT flag a legitimate host", () => {
    assert.equal(isFlaggedHost("https://app.uniswap.org/"), false);
  });

  it("returns false for malformed URLs", () => {
    assert.equal(isFlaggedHost("not-a-url"), false);
  });
});

describe("isFlaggedHost — live feed", () => {
  it("uses live feed when present + fresh", () => {
    setFlaggedHosts(["bad.example", "very.bad.example"]);
    assert.equal(isFlaggedHost("https://bad.example/"), true);
    assert.equal(isFlaggedHost("https://sub.bad.example/"), true);
  });
});

describe("SIGNATURE_PRODUCING_METHODS", () => {
  it("includes the well-known signing methods", () => {
    assert.equal(SIGNATURE_PRODUCING_METHODS.has("personal_sign"), true);
    assert.equal(SIGNATURE_PRODUCING_METHODS.has("eth_signTypedData_v4"), true);
    assert.equal(SIGNATURE_PRODUCING_METHODS.has("eth_sendTransaction"), true);
  });

  it("does NOT include read methods", () => {
    assert.equal(SIGNATURE_PRODUCING_METHODS.has("eth_chainId"), false);
    assert.equal(SIGNATURE_PRODUCING_METHODS.has("eth_call"), false);
  });
});

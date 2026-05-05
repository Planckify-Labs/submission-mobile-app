/**
 * Unit tests for the typed transfer/token-kind errors appended to
 * `services/chains/sui/errorCodes.ts` by Task 07.
 *
 * Spec reference: `docs/sui-chain-support-spec.md` §4.1.
 *
 * The existing `errorCodes` exports (`SUI_ERROR_CODES`,
 * `assertSuiErrorCode`, `suiError`) are covered by
 * `SuiAdapter.errorCodes.test.ts`. This file specifically asserts the
 * stable `name` strings + carried fields on the new typed classes,
 * since downstream code (executors, UI) branches on `err.name === "..."`
 * without depending on class identity.
 */

import { describe, expect, it } from "vitest";

import {
  InvalidSuiAddressLegacyError,
  SuiClosedLoopPolicyDeniedError,
  SuiClosedLoopPolicyUnresolvedError,
  SuiInsufficientCoinError,
  SuiRegulatedCoinDeniedError,
  SuiUnsupportedTokenKindError,
  UnsupportedSuiSchemeError,
} from "./errorCodes.ts";

const COIN_TYPE = "0x2::sui::SUI";
const POLICY_ID =
  "0x000000000000000000000000000000000000000000000000000000000000beef";

describe("SuiUnsupportedTokenKindError", () => {
  it("carries a stable name + coinType", () => {
    const err = new SuiUnsupportedTokenKindError(COIN_TYPE);
    expect(err.name).toBe("SuiUnsupportedTokenKindError");
    expect(err.coinType).toBe(COIN_TYPE);
    expect(err.message).toContain(COIN_TYPE);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("SuiInsufficientCoinError", () => {
  it("uses default message when none supplied", () => {
    const err = new SuiInsufficientCoinError(COIN_TYPE);
    expect(err.name).toBe("SuiInsufficientCoinError");
    expect(err.coinType).toBe(COIN_TYPE);
    expect(err.message).toContain("Insufficient");
  });

  it("respects a custom message", () => {
    const err = new SuiInsufficientCoinError(COIN_TYPE, "need 5 SUI more");
    expect(err.message).toBe("need 5 SUI more");
    expect(err.coinType).toBe(COIN_TYPE);
  });
});

describe("SuiRegulatedCoinDeniedError", () => {
  it("captures cause + name + coinType", () => {
    const cause = new Error("EAddressDeniedForCoin");
    const err = new SuiRegulatedCoinDeniedError(COIN_TYPE, cause);
    expect(err.name).toBe("SuiRegulatedCoinDeniedError");
    expect(err.coinType).toBe(COIN_TYPE);
    expect(err.cause).toBe(cause);
  });
});

describe("SuiClosedLoopPolicyDeniedError", () => {
  it("captures policy id, coin type, and cause", () => {
    const cause = { abort_code: 42 };
    const err = new SuiClosedLoopPolicyDeniedError(COIN_TYPE, POLICY_ID, cause);
    expect(err.name).toBe("SuiClosedLoopPolicyDeniedError");
    expect(err.coinType).toBe(COIN_TYPE);
    expect(err.tokenPolicyId).toBe(POLICY_ID);
    expect(err.cause).toBe(cause);
  });
});

describe("SuiClosedLoopPolicyUnresolvedError", () => {
  it("carries a stable name + coinType", () => {
    const err = new SuiClosedLoopPolicyUnresolvedError(COIN_TYPE);
    expect(err.name).toBe("SuiClosedLoopPolicyUnresolvedError");
    expect(err.coinType).toBe(COIN_TYPE);
    expect(err.message).toContain("TokenPolicy");
  });
});

describe("UnsupportedSuiSchemeError", () => {
  it("carries the scheme string", () => {
    const err = new UnsupportedSuiSchemeError("Secp256k1");
    expect(err.name).toBe("UnsupportedSuiSchemeError");
    expect(err.scheme).toBe("Secp256k1");
    expect(err.message).toContain("Secp256k1");
  });
});

describe("InvalidSuiAddressLegacyError", () => {
  it("carries the rejected address", () => {
    const legacy = "0x" + "ab".repeat(20); // 20-byte legacy
    const err = new InvalidSuiAddressLegacyError(legacy);
    expect(err.name).toBe("InvalidSuiAddressLegacyError");
    expect(err.address).toBe(legacy);
    expect(err.message).toContain("32-byte");
  });
});

/**
 * Compliance test for the Sui adapter error-code contract.
 * Mirror of `services/chains/solana/SolanaAdapter.errorCodes.test.ts`
 * scope. Run from mobile-app root:
 *   node --test --experimental-strip-types services/chains/sui/SuiAdapter.errorCodes.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSuiErrorCode,
  isSuiContractCode,
  SUI_ERROR_CODES,
  suiError,
} from "./errorCodes.ts";

describe("SUI_ERROR_CODES — shape", () => {
  it("every constant is an integer", () => {
    for (const [k, v] of Object.entries(SUI_ERROR_CODES)) {
      assert.equal(
        Number.isInteger(v),
        true,
        `${k} is not integer-typed: ${typeof v}`,
      );
    }
  });

  it("contract covers the minimum codes the adapter is documented to emit", () => {
    assert.equal(SUI_ERROR_CODES.USER_REJECT, 4001);
    assert.equal(SUI_ERROR_CODES.UNAUTHORIZED, 4100);
    assert.equal(SUI_ERROR_CODES.METHOD_NOT_FOUND, -32601);
    assert.equal(SUI_ERROR_CODES.INVALID_PARAMS, -32602);
    assert.equal(SUI_ERROR_CODES.INTERNAL, -32603);
  });
});

describe("assertSuiErrorCode", () => {
  it("accepts every contract code", () => {
    for (const v of Object.values(SUI_ERROR_CODES)) {
      assert.doesNotThrow(() => assertSuiErrorCode(v));
    }
  });

  it("rejects a code outside the contract", () => {
    assert.throws(() => assertSuiErrorCode(9999), /non-contract error code/);
  });

  it("rejects a near-miss (4101) explicitly", () => {
    assert.throws(() => assertSuiErrorCode(4101));
  });
});

describe("isSuiContractCode", () => {
  it("true on contract code", () => {
    assert.equal(isSuiContractCode(4001), true);
  });

  it("false off-contract", () => {
    assert.equal(isSuiContractCode(123), false);
  });
});

describe("suiError — wire shape", () => {
  it("omits data when undefined", () => {
    const e = suiError(SUI_ERROR_CODES.UNAUTHORIZED, "not authorised");
    assert.deepEqual(e, { code: 4100, message: "not authorised" });
    assert.equal(Object.hasOwn(e, "data"), false);
  });

  it("preserves data when supplied", () => {
    const e = suiError(SUI_ERROR_CODES.INVALID_PARAMS, "bad", { reason: "x" });
    assert.deepEqual(e, {
      code: -32602,
      message: "bad",
      data: { reason: "x" },
    });
  });
});

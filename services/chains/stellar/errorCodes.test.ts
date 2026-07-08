/**
 * Contract test for the typed Stellar transfer/account errors — each
 * must carry a stable `name` string so `mapUnknownError` /
 * `services/agent-executors/types.ts` can branch on `err.name` without
 * depending on class identity (spec §4.1, §4.3).
 */

import { describe, expect, it } from "vitest";

import {
  assertStellarErrorCode,
  SEP0043_ERROR_CODES,
  STELLAR_ERROR_CODES,
  StellarAccountNotFoundError,
  StellarDestinationUnfundedError,
  StellarInsufficientCreateAmountError,
  StellarInsufficientReserveError,
  StellarNoTrustlineError,
  StellarSequenceNumberRaceError,
  toSep0043Code,
} from "./errorCodes.ts";

describe("typed Stellar errors", () => {
  it("StellarAccountNotFoundError carries the address and a stable name", () => {
    const err = new StellarAccountNotFoundError("GADDRESS");
    expect(err.name).toBe("StellarAccountNotFoundError");
    expect(err.address).toBe("GADDRESS");
    expect(err).toBeInstanceOf(Error);
  });

  it("StellarDestinationUnfundedError carries the address and a stable name", () => {
    const err = new StellarDestinationUnfundedError("GDEST");
    expect(err.name).toBe("StellarDestinationUnfundedError");
    expect(err.address).toBe("GDEST");
  });

  it("StellarNoTrustlineError carries address/code/issuer and a stable name", () => {
    const err = new StellarNoTrustlineError("GDEST", "USDC", "GISSUER");
    expect(err.name).toBe("StellarNoTrustlineError");
    expect(err.address).toBe("GDEST");
    expect(err.code).toBe("USDC");
    expect(err.issuer).toBe("GISSUER");
  });

  it("StellarInsufficientReserveError has a stable name", () => {
    const err = new StellarInsufficientReserveError();
    expect(err.name).toBe("StellarInsufficientReserveError");
  });

  it("StellarInsufficientCreateAmountError carries both amounts and a stable name", () => {
    const err = new StellarInsufficientCreateAmountError(
      5_000_000n,
      10_000_000n,
    );
    expect(err.name).toBe("StellarInsufficientCreateAmountError");
    expect(err.startingBalanceStroops).toBe(5_000_000n);
    expect(err.minimumStroops).toBe(10_000_000n);
  });

  it("StellarSequenceNumberRaceError has a stable name", () => {
    const err = new StellarSequenceNumberRaceError();
    expect(err.name).toBe("StellarSequenceNumberRaceError");
  });
});

describe("dApp-bridge error codes (docs/stellar-dapp-bridge-spec.md §1.1)", () => {
  it("assertStellarErrorCode accepts every declared code", () => {
    for (const code of Object.values(STELLAR_ERROR_CODES)) {
      expect(() => assertStellarErrorCode(code)).not.toThrow();
    }
  });

  it("assertStellarErrorCode rejects an undeclared code", () => {
    expect(() => assertStellarErrorCode(-1)).toThrow();
  });

  it("toSep0043Code maps user-reject to -4 (SEP-0043 §1.1)", () => {
    expect(toSep0043Code(STELLAR_ERROR_CODES.USER_REJECT)).toBe(
      SEP0043_ERROR_CODES.USER_REJECTED,
    );
  });

  it("toSep0043Code maps unauthorized/invalid-params/unsupported to -3", () => {
    expect(toSep0043Code(STELLAR_ERROR_CODES.UNAUTHORIZED)).toBe(
      SEP0043_ERROR_CODES.INVALID_REQUEST,
    );
    expect(toSep0043Code(STELLAR_ERROR_CODES.INVALID_PARAMS)).toBe(
      SEP0043_ERROR_CODES.INVALID_REQUEST,
    );
    expect(toSep0043Code(STELLAR_ERROR_CODES.UNSUPPORTED)).toBe(
      SEP0043_ERROR_CODES.INVALID_REQUEST,
    );
  });

  it("toSep0043Code maps external-service failures to -2", () => {
    expect(toSep0043Code(STELLAR_ERROR_CODES.EXTERNAL_SERVICE)).toBe(
      SEP0043_ERROR_CODES.EXTERNAL_SERVICE,
    );
  });

  it("toSep0043Code defaults unknown codes to -1 (internal)", () => {
    expect(toSep0043Code(STELLAR_ERROR_CODES.INTERNAL)).toBe(
      SEP0043_ERROR_CODES.INTERNAL,
    );
    expect(toSep0043Code(STELLAR_ERROR_CODES.GENERIC)).toBe(
      SEP0043_ERROR_CODES.INTERNAL,
    );
    expect(toSep0043Code(999999)).toBe(SEP0043_ERROR_CODES.INTERNAL);
  });
});

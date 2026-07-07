/**
 * Contract test for the typed Stellar transfer/account errors — each
 * must carry a stable `name` string so `mapUnknownError` /
 * `services/agent-executors/types.ts` can branch on `err.name` without
 * depending on class identity (spec §4.1, §4.3).
 */

import { describe, expect, it } from "vitest";

import {
  StellarAccountNotFoundError,
  StellarDestinationUnfundedError,
  StellarInsufficientCreateAmountError,
  StellarInsufficientReserveError,
  StellarNoTrustlineError,
  StellarSequenceNumberRaceError,
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

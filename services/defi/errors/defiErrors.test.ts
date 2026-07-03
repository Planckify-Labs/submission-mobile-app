import { describe, expect, it } from "vitest";
import {
  classifySuiMoveError,
  DefiError,
} from "@/services/defi/errors/defiErrors";

/**
 * Sui/Move build-error classification (agent tool-error standard). A Sui
 * `tx.build()` fails with messages like "InsufficientCoinBalance"; collapsing
 * every one to a generic `deposit_failed` made the DeFi agent invent a
 * misleading "venue unavailable" story. The balance case MUST become
 * `insufficient_funds` so the agent takes its terminal "not enough — try a
 * smaller amount" branch and the card shows "Not enough balance".
 */
describe("classifySuiMoveError", () => {
  it("maps InsufficientCoinBalance → insufficient_funds", () => {
    const e = classifySuiMoveError(
      new Error(
        "Transaction resolution failed: InsufficientCoinBalance in command 1",
      ),
      "deposit_failed",
    );
    expect(e).toBeInstanceOf(DefiError);
    expect(e.code).toBe("insufficient_funds");
    expect(e.message).toBe("insufficient_balance");
  });

  it("maps a missing-gas-coin error → insufficient_funds", () => {
    expect(
      classifySuiMoveError(
        new Error("No valid gas coins found for the transaction"),
        "deposit_failed",
      ).code,
    ).toBe("insufficient_funds");
  });

  it("maps a transport error → network_error", () => {
    expect(
      classifySuiMoveError(
        new Error("fetch failed: ECONNREFUSED"),
        "deposit_failed",
      ).code,
    ).toBe("network_error");
  });

  it("maps a MoveAbort → the fallback code with a protocol_rejected reason", () => {
    const e = classifySuiMoveError(
      new Error("MoveAbort(MoveLocation { ... }, 1004) in command 2"),
      "withdraw_failed",
    );
    expect(e.code).toBe("withdraw_failed");
    expect(e.message).toBe("protocol_rejected");
  });

  it("falls back to the given terminal code with a build_failed reason", () => {
    const e = classifySuiMoveError(
      new Error("something odd"),
      "deposit_failed",
    );
    expect(e.code).toBe("deposit_failed");
    expect(e.message).toBe("build_failed");
  });

  it("passes a DefiError through unchanged (idempotent)", () => {
    const orig = new DefiError("unsupported_asset", "scallop: FOO");
    expect(classifySuiMoveError(orig, "deposit_failed")).toBe(orig);
  });
});

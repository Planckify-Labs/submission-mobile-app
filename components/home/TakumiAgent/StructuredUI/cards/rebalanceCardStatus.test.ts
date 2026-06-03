/**
 * Unit tests for `resolveRebalanceCardStatus`
 * (regression for: pressing "Approve rebalance" rendered
 * "You declined this rebalance").
 *
 * Run under `node:test` via `pnpm test:node`.
 */

import { strict as a } from "node:assert";
import { test } from "node:test";
import { resolveRebalanceCardStatus } from "./rebalanceCardStatus.ts";

test("live: no decision/result yet → null (interactive)", () => {
  a.equal(resolveRebalanceCardStatus({ state: "input-available" }), null);
  a.equal(resolveRebalanceCardStatus({}), null);
});

test("user tapped Not now → declined", () => {
  a.equal(
    resolveRebalanceCardStatus({
      state: "output-error",
      error: "user_declined",
      output: { status: "rejected", user_decision: "rejected" },
    }),
    "declined",
  );
});

test("approved + executor SUCCESS → executed (the original bug: was 'declined')", () => {
  // After approval the dispatcher overwrites output with the executor's
  // ToolResult — which has no user_decision.
  a.equal(
    resolveRebalanceCardStatus({
      state: "output-available",
      output: { status: "success" },
    }),
    "executed",
  );
});

test("approved + executor FAILURE → failed (not 'declined')", () => {
  a.equal(
    resolveRebalanceCardStatus({
      state: "output-error",
      error: "rebalance_partial_failure",
      output: { status: "failed" },
    }),
    "failed",
  );
});

test("explicit approved decision (no result yet) → executed", () => {
  a.equal(
    resolveRebalanceCardStatus({ output: { user_decision: "approved" } }),
    "executed",
  );
});

test("user_declined wins even if a status is present", () => {
  a.equal(
    resolveRebalanceCardStatus({
      state: "output-error",
      error: "user_declined",
      output: { status: "failed", user_decision: "rejected" },
    }),
    "declined",
  );
});

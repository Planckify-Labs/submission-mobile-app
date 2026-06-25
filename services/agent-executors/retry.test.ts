/**
 * Unit tests for `executeWithRetry` and `executeToolWithRetry`.
 *
 * Uses Node's built-in `node:test` runner with type stripping (the same
 * pattern as `services/permissionGrantStore.test.ts`). Run from the
 * mobile-app root:
 *
 *     node --test --experimental-strip-types \
 *         services/agent-executors/retry.test.ts
 *
 * The tests intentionally do NOT import the full executor registry — we
 * exercise `executeWithRetry` with hand-crafted async mocks so we can
 * make assertions about call counts, backoff deltas, and the onAttempt
 * hook without pulling in viem / expo-secure-store / any native modules.
 *
 * `executeToolWithRetry` is tested only for the `unknown_tool` path
 * because loading `./index.ts` would transitively pull in the mobile
 * runtime. The registry-hit path is trivial delegation to
 * `executeWithRetry` which IS covered here.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AuthorizationToken } from "../agentSession/authorizeToolCall.ts";
import { executeToolWithRetry, executeWithRetry } from "./retry.ts";
import {
  type ExecutorContext,
  isTransientReadError,
  type ToolResult,
} from "./types.ts";

// `executeToolWithRetry` requires an AuthorizationToken (INV-3). In real
// code the only constructor is `authorizeToolCall`; the token carries no
// runtime authority, so tests pass an inert stand-in.
const TEST_TOKEN = {} as unknown as AuthorizationToken;

function ok(): ToolResult {
  return { status: "success", data: { value: 42 } };
}

function transient(message = "network error"): ToolResult {
  return { status: "failed", error: message };
}

describe("executeWithRetry — retry decisions", () => {
  it("returns success immediately without sleeping", async () => {
    let calls = 0;
    const result = await executeWithRetry(async () => {
      calls++;
      return ok();
    });
    assert.equal(calls, 1);
    assert.equal(result.status, "success");
  });

  it("retries transient network error and succeeds on the 2nd retry", async () => {
    const sequence: ToolResult[] = [
      transient("network error"),
      transient("network error"),
      ok(),
    ];
    let calls = 0;
    const attempts: Array<{ attempt: number; lastError: string | undefined }> =
      [];
    const result = await executeWithRetry(
      async () => {
        calls++;
        return sequence[calls - 1]!;
      },
      {
        baseDelayMs: 1,
        onAttempt: (attempt, lastError) => {
          attempts.push({ attempt, lastError });
        },
      },
    );
    assert.equal(calls, 3);
    assert.equal(result.status, "success");
    assert.deepEqual(attempts, [
      { attempt: 1, lastError: "network error" },
      { attempt: 2, lastError: "network error" },
    ]);
  });

  it("user_declined returns on the first attempt with no retries", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return { status: "failed", error: "user_declined" } as ToolResult;
      },
      { baseDelayMs: 1 },
    );
    assert.equal(calls, 1);
    assert.equal(result.status, "failed");
    assert.equal(result.error, "user_declined");
  });

  it("insufficient_funds returns on the first attempt with no retries", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return { status: "failed", error: "insufficient_funds" } as ToolResult;
      },
      { baseDelayMs: 1 },
    );
    assert.equal(calls, 1);
    assert.equal(result.error, "insufficient_funds");
  });

  it("wallet_type_cannot_execute is not retried", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return {
          status: "failed",
          error: "wallet_type_cannot_execute",
        } as ToolResult;
      },
      { baseDelayMs: 1 },
    );
    assert.equal(calls, 1);
    assert.equal(result.error, "wallet_type_cannot_execute");
  });

  it("never retries a result carrying a tx_hash, even if status is failed and error is retryable", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return {
          status: "failed",
          tx_hash: "0xabc",
          error: "network error",
        } as ToolResult;
      },
      { baseDelayMs: 1 },
    );
    // Anti-double-spend invariant — must be exactly one call.
    assert.equal(calls, 1);
    assert.equal(result.tx_hash, "0xabc");
    assert.equal(result.status, "failed");
  });

  it("exhausts the retry budget and returns the last failure", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return transient(`network error ${calls}`);
      },
      { baseDelayMs: 1 },
    );
    // 1 initial + 2 retries = 3 total calls by default.
    assert.equal(calls, 3);
    assert.equal(result.status, "failed");
    assert.equal(result.error, "network error 3");
  });

  it("respects a custom maxRetries of 0 (no retries at all)", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return transient();
      },
      { maxRetries: 0, baseDelayMs: 1 },
    );
    assert.equal(calls, 1);
    assert.equal(result.status, "failed");
  });

  it("retries on other spec-listed substrings: nonce, rate limit, econnreset, timeout, fetch failed", async () => {
    for (const msg of [
      "nonce too low",
      "rate limit exceeded",
      "ECONNRESET",
      "request timeout",
      "fetch failed",
    ]) {
      let calls = 0;
      await executeWithRetry(
        async () => {
          calls++;
          return calls === 1 ? transient(msg) : ok();
        },
        { baseDelayMs: 1 },
      );
      assert.equal(calls, 2, `expected retry for "${msg}"`);
    }
  });
});

describe("executeWithRetry — isRetryable override (read tolerance)", () => {
  it("default predicate does NOT retry a transient 5xx (service_unavailable)", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return { status: "failed", error: "service_unavailable" } as ToolResult;
      },
      { baseDelayMs: 1 },
    );
    // Write-safe default: a 5xx is not retried, so a single call is made.
    assert.equal(calls, 1);
    assert.equal(result.error, "service_unavailable");
  });

  it("isTransientReadError retries a transient 5xx then succeeds (the catalog fix)", async () => {
    const sequence: ToolResult[] = [
      { status: "failed", error: "service_unavailable" },
      ok(),
    ];
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return sequence[calls - 1]!;
      },
      { baseDelayMs: 1, isRetryable: isTransientReadError },
    );
    assert.equal(calls, 2);
    assert.equal(result.status, "success");
  });

  it("isTransientReadError still does NOT retry a deterministic auth error", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls++;
        return {
          status: "failed",
          error: "authentication_required",
        } as ToolResult;
      },
      { baseDelayMs: 1, isRetryable: isTransientReadError },
    );
    assert.equal(calls, 1);
    assert.equal(result.error, "authentication_required");
  });
});

describe("executeWithRetry — backoff spacing", () => {
  it("default backoff is 1000ms then 2000ms", async () => {
    const sequence: ToolResult[] = [
      transient(),
      transient(),
      { status: "success" },
    ];
    let calls = 0;
    const attemptTimestamps: number[] = [];
    const start = Date.now();
    attemptTimestamps.push(0);
    await executeWithRetry(
      async () => {
        calls++;
        return sequence[calls - 1]!;
      },
      {
        onAttempt: (_attempt, _lastError) => {
          attemptTimestamps.push(Date.now() - start);
        },
      },
    );
    // Three attempts total. First fires immediately; the onAttempt hook
    // fires immediately BEFORE each retry, so the timestamps collected
    // in `attemptTimestamps` are: [0 (first call — pushed manually),
    // ~1000 (before 2nd call, after 1st sleep),
    // ~3000 (before 3rd call, after 2nd sleep of 2s)].
    assert.equal(calls, 3);
    assert.equal(attemptTimestamps.length, 3);

    const firstRetryDelay = attemptTimestamps[1]! - attemptTimestamps[0]!;
    const secondRetryDelay = attemptTimestamps[2]! - attemptTimestamps[1]!;

    // Allow generous slack for timer scheduling but tight enough to
    // catch an off-by-one in the backoff formula (e.g. 0s/1s or 2s/4s).
    assert.ok(
      firstRetryDelay >= 950 && firstRetryDelay < 1500,
      `first retry delay ${firstRetryDelay}ms not ~1000ms`,
    );
    assert.ok(
      secondRetryDelay >= 1950 && secondRetryDelay < 2500,
      `second retry delay ${secondRetryDelay}ms not ~2000ms`,
    );
  });
});

describe("executeWithRetry — onAttempt hook", () => {
  it("is called with (1, lastError) before the 2nd attempt and (2, lastError) before the 3rd", async () => {
    const sequence: ToolResult[] = [
      transient("network error A"),
      transient("network error B"),
      transient("network error C"),
    ];
    let calls = 0;
    const calls_: Array<[number, string | undefined]> = [];
    await executeWithRetry(
      async () => {
        calls++;
        return sequence[calls - 1]!;
      },
      {
        baseDelayMs: 1,
        onAttempt: (attempt, lastError) => {
          calls_.push([attempt, lastError]);
        },
      },
    );
    assert.deepEqual(calls_, [
      [1, "network error A"],
      [2, "network error B"],
    ]);
  });

  it("is NOT called before the first attempt", async () => {
    let hookCalls = 0;
    await executeWithRetry(async () => ok(), {
      baseDelayMs: 1,
      onAttempt: () => {
        hookCalls++;
      },
    });
    assert.equal(hookCalls, 0);
  });
});

describe("executeToolWithRetry — registry dispatch", () => {
  it("unknown tool returns { status: 'failed', error: 'unknown_tool' } without touching the timer", async () => {
    const fakeContext = {} as unknown as ExecutorContext;
    const start = Date.now();
    const result = await executeToolWithRetry(
      "definitely_not_a_real_tool",
      {},
      fakeContext,
      TEST_TOKEN,
      { baseDelayMs: 10_000 },
      // Inject an empty registry so the function does not attempt to
      // `import("./index")` — which would transitively load viem +
      // expo-secure-store + the `@/` path alias and blow up under the
      // raw-Node test runner.
      {},
    );
    const elapsed = Date.now() - start;
    assert.equal(result.status, "failed");
    assert.equal(result.error, "unknown_tool");
    // Must not have slept — if it did, elapsed would be >= 10s.
    assert.ok(elapsed < 500, `unexpected delay ${elapsed}ms`);
  });

  it("known tool in injected registry is dispatched via executeWithRetry", async () => {
    const fakeContext = {} as unknown as ExecutorContext;
    let calls = 0;
    const registry = {
      get_balance: async () => {
        calls++;
        return calls === 1
          ? transient("network error")
          : ({ status: "success", data: { balance: "0" } } as ToolResult);
      },
    };
    const result = await executeToolWithRetry(
      "get_balance",
      { chain_id: 1 },
      fakeContext,
      TEST_TOKEN,
      { baseDelayMs: 1 },
      registry,
    );
    assert.equal(calls, 2);
    assert.equal(result.status, "success");
  });
});

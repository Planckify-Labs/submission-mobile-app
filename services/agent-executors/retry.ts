/**
 * Retry wrapper for mobile tool executors.
 *
 * Implements AGENT_PROTOCOL §10 "Retry Logic" on top of the task-10
 * executor registry in `./index.ts`. The server-side agent already
 * decides what to do with a final failed `ToolResult`, so this wrapper
 * is intentionally narrow: it only retries _transient_ errors, and it
 * is rigorously fail-open on anything that might have already moved
 * user funds.
 *
 * Non-negotiables from the spec (see `tasks/16_retry_logic_istaken_true.md`):
 *
 *  1. `status === "success"` returns immediately.
 *  2. Any result carrying a `tx_hash` returns immediately, even if
 *     `status === "failed"`. Retrying after we already have a signed
 *     hash is how you double-spend.
 *  3. `isRetryableError(error)` must be `true` to retry — we explicitly
 *     do NOT retry `user_declined`, `insufficient_funds`,
 *     `wallet_type_cannot_execute`, or contract reverts.
 *  4. Backoff is `baseDelayMs * (attempt + 1)` — 1s then 2s by default
 *     for a total of 3 attempts (1 initial + 2 retries).
 *  5. The `onAttempt` hook fires _before_ each retry (not before the
 *     first call) so the preview/confirm UI in task 09 can flip to a
 *     "Retrying…" indicator.
 *
 * The `isRetryableError` predicate is imported from `./types` — we do
 * NOT reimplement it here. If the spec substring list needs to grow,
 * extend the helper in `types.ts` in place.
 */

import type { AuthorizationToken } from "../agentSession/authorizeToolCall.ts";
import {
  type ExecutorContext,
  isRetryableError,
  type MobileToolExecutor,
  type ToolInput,
  type ToolResult,
} from "./types.ts";

/**
 * Options consumed by both `executeWithRetry` and `executeToolWithRetry`.
 */
export interface RetryOptions {
  /**
   * Maximum number of _additional_ attempts after the first. Default is
   * 2 — i.e. up to 3 total attempts. Clamped to `>= 0`.
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds. The `n`-th retry (0-indexed) sleeps for
   * `baseDelayMs * (n + 1)` — so the default of 1000ms gives 1s, 2s.
   */
  baseDelayMs?: number;
  /**
   * Called _before_ each retry (not before the first attempt).
   * `attempt` is 1-indexed — the value passed is the attempt number
   * that is _about to run_. `lastError` is the `error` field from the
   * previous failed `ToolResult`, which is what the UI should surface
   * as "Retrying because: …".
   */
  onAttempt?: (attempt: number, lastError: string | undefined) => void;
  /**
   * Predicate deciding whether a failed result's `error` is worth
   * retrying. Defaults to `isRetryableError` (the conservative,
   * write-safe set: only `network_error`-class transients). Idempotent
   * READ tools can pass a broader predicate (`isTransientReadError`) so
   * a transient 5xx / 503 / 429 / unclassified hiccup gets a second
   * chance instead of surfacing a one-shot failure card — a re-read can
   * never double-spend, so the wider net is safe there only.
   */
  isRetryable?: (error: string | undefined) => boolean;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * `setTimeout` wrapped in a Promise. Kept as a module-level function so
 * tests can monkey-patch or fake-timer it without reaching inside
 * `executeWithRetry`.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Core retry loop. Takes a nullary async function that returns a
 * `ToolResult` and applies the §10 retry rules. Any thrown error is
 * considered a bug in the executor — the task-10 contract says
 * executors must never throw — so we let it propagate rather than
 * swallowing it and risking an infinite retry loop on programmer
 * errors.
 */
export async function executeWithRetry<T extends ToolResult>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = Math.max(0, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
  const baseDelayMs = Math.max(0, opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const onAttempt = opts.onAttempt;
  const retryable = opts.isRetryable ?? isRetryableError;

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // For retries (attempt > 0) invoke the hook with the 1-indexed
    // attempt number that's about to run and the error from the prior
    // try. The very first call must NOT fire the hook — the UI only
    // wants to show "Retrying…" when an actual retry is in flight.
    if (attempt > 0) {
      onAttempt?.(attempt, lastError);
    }

    const result = await fn();

    // Rule 1: success short-circuits.
    if (result.status === "success") {
      return result;
    }

    // Rule 2: fail-open guard — any result carrying a tx_hash is final,
    // no matter what `status` says. This is the anti-double-spend
    // invariant from the spec. Keep this check BEFORE the retryable
    // check so a "network" error that still produced a hash is NOT
    // retried.
    if (result.tx_hash) {
      return result;
    }

    // Rule 3: non-retryable errors (user_declined, insufficient_funds,
    // wallet_type_cannot_execute, contract reverts, …) return as-is.
    if (!retryable(result.error)) {
      return result;
    }

    // Out of retry budget — return the last failure so the agent can
    // decide what to do next.
    if (attempt >= maxRetries) {
      return result;
    }

    // Rule 4: backoff = baseDelayMs * (attempt + 1). `attempt` here is
    // still 0-indexed, so this is 1s, 2s, 3s, … for the default base.
    lastError = result.error;
    await sleep(baseDelayMs * (attempt + 1));
  }

  // Unreachable — the loop always returns from inside. TypeScript can't
  // prove it because of the `<=` bound, so we throw a sentinel instead
  // of `as T`-casting a bogus value.
  throw new Error("executeWithRetry: loop exited without a result");
}

/**
 * Optional fourth argument to `executeToolWithRetry` — lets callers
 * (primarily unit tests) inject a stand-in registry so they don't have
 * to load the real `./index` module. Production callers should omit it
 * and let the function reach for the real `EXECUTORS` via a dynamic
 * `import("./index")`.
 */
export type ExecutorRegistry = Record<string, MobileToolExecutor>;

/**
 * Convenience wrapper that looks a tool up in the mobile executor
 * registry and runs it through `executeWithRetry`. This is the entry
 * point task 09's SSE dispatcher will call for non-interactive tool
 * dispatches (silent reads + confirmed writes).
 *
 * Unknown tool names return a `{ status: "failed", error: "unknown_tool" }`
 * result rather than throwing — the dispatcher forwards the result
 * verbatim to the server and the agent can recover.
 *
 * The registry is loaded lazily via `await import("./index")` so that
 * `retry.ts` can be imported in environments where the transitive
 * executor dependencies — viem clients, expo-secure-store, the `@/`
 * path alias — would otherwise blow up at import time. Tests may pass
 * a `registry` override to avoid triggering the dynamic import at all.
 *
 * `token` is an {@link AuthorizationToken} minted ONLY by
 * `authorizeToolCall()` (deny-layer spec §6.4 / INV-3). It is not read at
 * runtime — its sole purpose is the compile-time guarantee that no code
 * path can execute a tool without having passed through the single
 * authorization gate. A caller that never authorized the call cannot
 * produce a value of this type, so it cannot call this function.
 */
export async function executeToolWithRetry(
  toolName: string,
  input: ToolInput,
  context: ExecutorContext,
  token: AuthorizationToken,
  opts: RetryOptions = {},
  registry?: ExecutorRegistry,
): Promise<ToolResult> {
  // The token carries no runtime authority — see the brand note in
  // `authorizeToolCall.ts`. Reference it so linters don't flag it as
  // unused; the guarantee is entirely in the type system.
  void token;
  const resolved: ExecutorRegistry =
    registry ?? (await import("./index.ts")).EXECUTORS;
  const executor = resolved[toolName];
  if (!executor) {
    return { status: "failed", error: "unknown_tool" };
  }
  return executeWithRetry(() => executor(input, context), opts);
}

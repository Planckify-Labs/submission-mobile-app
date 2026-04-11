/**
 * Mobile agent tool executor registry.
 *
 * This is the mobile-side counterpart to the server's `TOOL_REGISTRY`
 * (see `takumi-agent-api/src/tools/registry.ts`). The SSE dispatcher
 * from task 09 imports `EXECUTORS` and looks up the right function by
 * the `name` field on each `tool_pending` payload.
 *
 * Every entry here MUST correspond to a tool with `executor: "mobile"`
 * in the server registry. If the server adds a new mobile tool, add a
 * matching entry here — the unit test below (see
 * `__tests__/registryParity.ts` once a test runner exists) will be
 * the gate that catches drift.
 *
 * Tool names enumerated from
 *   takumi-agent-api/src/tools/registry.ts @ 2026-04-11
 * (11 tools total — if you add more on the server, grep for
 * `executor: 'mobile'` there and update both sides together).
 */

export * from "./chainRouter";
export * from "./types";

import { READ_EXECUTORS } from "./reads";
import { SIMULATE_EXECUTORS } from "./simulate";
import type { MobileToolExecutor } from "./types";
import { WRITE_EXECUTORS } from "./writes";

/**
 * The registry itself. Keys are the canonical tool names the server
 * emits via `tool_pending.name`. Task 09's SSE dispatcher does:
 *
 *     const executor = EXECUTORS[payload.name];
 *     if (!executor) return rejectTool(payload, "unknown_tool");
 *     const result = await executor(payload.input, context);
 *
 * Do NOT introduce fuzzy matching — unknown tools should fail loudly
 * so we notice new server additions immediately.
 */
export const EXECUTORS: Record<string, MobileToolExecutor> = {
  ...READ_EXECUTORS,
  ...SIMULATE_EXECUTORS,
  ...WRITE_EXECUTORS,
};

/**
 * Expected mobile tool list — hardcoded because the server lives in a
 * sibling package that we don't import from directly at build time.
 * Kept in sync by visual review against
 *   takumi-agent-api/src/tools/registry.ts
 *
 * If you edit this list, also update the server registry and the
 * block comment at the top of this file.
 */
export const EXPECTED_MOBILE_TOOLS: ReadonlyArray<string> = [
  // reads
  "get_balance",
  "get_wallet_balance",
  "read_contract",
  "get_transaction",
  "get_wallet_address",
  "get_supported_chains",
  // simulate
  "estimate_gas",
  // writes
  "send_native_token",
  "transfer_erc20",
  "write_contract",
  "approve_erc20",
  "execute_booking",
  "cancel_booking",
  "create_purchase",
];

/**
 * Runtime assertion helper used by the app bootstrap in task 09 — call
 * once at startup so registry drift crashes loudly rather than
 * silently dropping tool calls.
 */
export function assertRegistryParity(): void {
  for (const name of EXPECTED_MOBILE_TOOLS) {
    if (!(name in EXECUTORS)) {
      throw new Error(
        `[agent-executors] missing executor for tool "${name}" — ` +
          "check services/agent-executors/index.ts",
      );
    }
  }
}

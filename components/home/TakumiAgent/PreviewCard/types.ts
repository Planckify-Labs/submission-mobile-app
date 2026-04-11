/**
 * Local type stubs for the preview-card flow.
 *
 * NOTE: Task 09 (SSE dispatcher) will introduce the canonical mobile-side
 * `ToolPendingPayload` type and consolidate it into a shared types module.
 * Until then this file mirrors the server shape from
 * `AGENT_PROTOCOL.md` §8 `tool_pending` so the preview card has a concrete
 * contract it can be wired against without taking a dependency on a
 * not-yet-landed dispatcher module.
 */

import type { ToolCapability } from "@/services/permissionGrantStore";

/**
 * Server-emitted tool-category tag. The agent-api registry has a richer
 * enum (`blockchain_read`, `blockchain_write`, `takumipay`, ...) but the
 * preview card does not care about the specific value — it is passed
 * through so task 09 can use it when it wires the dispatcher.
 */
export type ToolCategory = string;

/**
 * Mobile mirror of the server-side `ToolPendingPayload`.
 *
 * Task 09 will replace this with the real typed payload that the SSE
 * dispatcher deserializes. Until then, consumers should import this type
 * from `./types` and switch to the dispatcher module once task 09 lands.
 */
export interface ToolPendingPayload {
  session_id: string;
  tool_call_id: string;
  name: string;
  input: Record<string, unknown>;
  meta: {
    executor: "mobile";
    capability: ToolCapability;
    category: ToolCategory;
    human_summary: string;
    amount_usd?: number;
  };
}

/**
 * Minimal shape of the dispatcher-side agent session needed by the
 * `showPreviewCard` factory. Task 09 will replace this with the real
 * `AgentSession` type from the dispatcher.
 */
export interface AgentSessionLike {
  id: string;
  pending_approvals: Map<string, ToolPendingPayload>;
}

/**
 * Callbacks injected by the dispatcher. Task 09 will export the real
 * `executeTool` / `rejectTool` functions; we accept them as props so the
 * component stays decoupled.
 */
export interface PreviewCardDispatcherCallbacks {
  executeTool: (
    payload: ToolPendingPayload,
    session: AgentSessionLike,
  ) => void | Promise<void>;
  rejectTool: (
    payload: ToolPendingPayload,
    session: AgentSessionLike,
    reason: "user_declined",
  ) => void | Promise<void>;
}

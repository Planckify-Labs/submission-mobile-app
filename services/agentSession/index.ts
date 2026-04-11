/**
 * Barrel exports for the mobile agent session module.
 *
 * Consumers should import from `services/agentSession` rather than
 * reaching into individual files — this keeps the public surface
 * small and makes future internal refactors cheaper.
 *
 * Task 13 / 14 / 15 chat-screen wiring pattern:
 *
 *     import {
 *       createAgentSession,
 *       type AgentSessionUIBindings,
 *     } from "@/services/agentSession";
 *
 *     const session = createAgentSession({
 *       session_id, wallet_context, messages, executorContext,
 *       connectedWallet, ui: {
 *         appendText: (delta) => setAssistantText((t) => t + delta),
 *         showStatus: (msg)   => setStatus(msg),
 *         showPreviewCard:    (p, ok, no) => showPreviewModal(p, ok, no),
 *         showApprovalSheet:  (p, ok, no) => showApprovalModal(p, ok, no),
 *         showError:          (msg, retry) => toast.error(msg),
 *         done:               (usage) => markTurnDone(usage),
 *       },
 *     });
 *     await session.start();
 */

export {
  type AgentSession,
  type AgentSessionUIBindings,
  type CreateAgentSessionOptions,
  createAgentSession,
} from "./agentSession.ts";
export { handleToolPending } from "./dispatcher.ts";
export { postRespond, rejectTool } from "./networkHelpers.ts";
export type {
  AgentEvent,
  ChatRequest,
  DonePayload,
  ErrorPayload,
  MobileResponse,
  StatusPayload,
  TextDeltaPayload,
  ToolCapability,
  ToolCategory,
  ToolExecutedPayload,
  ToolPendingPayload,
  ToolResult,
  WalletContext,
} from "./protocol.ts";
export {
  openSseStream,
  type SseClientHandle,
  type SseClientOptions,
} from "./sseClient.ts";

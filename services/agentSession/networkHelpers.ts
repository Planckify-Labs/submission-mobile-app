/**
 * HTTP helpers for the mobile → server tool-response leg of the Takumi
 * Agent protocol (AGENT_PROTOCOL.md §8.4).
 *
 * Both helpers POST to `<AGENT_API_BASE>/chat/respond` and attach the
 * same `secrectApiKey` query parameter that the existing `AgentMode`
 * chat integration uses (see `components/home/TakumiAgent/AgentMode.tsx`
 * for the source of truth). We intentionally do NOT introduce a new env
 * variable or auth mechanism — task 09 is plumbing, not config surgery.
 *
 * Base URL / api key source (identical to AgentMode.tsx):
 *   - `process.env.EXPO_PUBLIC_AI_API_URL`
 *   - `process.env.EXPO_PUBLIC_SECRET_AI_KEY`
 *
 * These are consumed lazily (inside the helpers, not at module-load) so
 * tests can monkey-patch `process.env` before the first call if needed.
 */

import type {
  MobileResponse,
  ToolPendingPayload,
  ToolResult,
} from "./protocol.ts";

/**
 * Resolve the Agent API base URL from the Expo env. Trailing slash is
 * stripped so callers can always concatenate a `"/chat"` suffix.
 */
function resolveBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_AI_API_URL;
  if (!raw) {
    throw new Error(
      "[agentSession] EXPO_PUBLIC_AI_API_URL is not set — cannot reach the agent API",
    );
  }
  return raw.replace(/\/+$/, "");
}

/**
 * Resolve the chat API key from the Expo env. Matches the query-param
 * name (`secrectApiKey`) used by `AgentMode.tsx` — see the note in
 * `AGENT_PROTOCOL.md` §8.2 which documents header + query-param both.
 */
function resolveApiKey(): string {
  const raw = process.env.EXPO_PUBLIC_SECRET_AI_KEY;
  if (!raw) {
    throw new Error(
      "[agentSession] EXPO_PUBLIC_SECRET_AI_KEY is not set — cannot authenticate to the agent API",
    );
  }
  return raw;
}

/**
 * Build the full POST URL for a path on the agent API. The api key is
 * passed as both a header and a query param to cover every auth shape
 * the server accepts (see the guard in the agent-api repo).
 */
function buildUrl(path: string): string {
  const base = resolveBaseUrl();
  const apiKey = resolveApiKey();
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${path}${sep}secrectApiKey=${encodeURIComponent(apiKey)}`;
}

/**
 * Common headers for POST /chat/respond. The server accepts any of
 * `x-api-key`, `Authorization: Bearer`, or the `secrectApiKey` query
 * param — we attach both the header and the query param so a proxy
 * stripping one still leaves the other intact.
 */
function buildHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": resolveApiKey(),
  };
}

/**
 * POST a successful `ToolResult` back to the agent API.
 *
 * The agent loop is blocked on this call (see AGENT_PROTOCOL §9) so we
 * must always return — if the fetch fails the dispatcher will fall
 * through to its outer error handler, which decides whether to retry or
 * abandon the session.
 */
export async function postRespond(
  sessionId: string,
  toolCallId: string,
  result: ToolResult,
): Promise<void> {
  const body: MobileResponse = {
    type: "tool_result",
    session_id: sessionId,
    tool_call_id: toolCallId,
    result,
  };

  const response = await fetch(buildUrl("/chat/respond"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `[agentSession] POST /chat/respond failed: ${response.status} ${text}`,
    );
  }
}

/**
 * POST a `tool_rejected` response back to the agent API. Used when the
 * dispatcher resolves `"blocked"`, when the user taps Reject in the
 * approval sheet, or when an executor fails in a non-retryable way.
 *
 * The payload shape matches §8.4. `reason` is an open union — canonical
 * values are `user_declined`, `insufficient_funds`, `network_error`, and
 * `wallet_type_cannot_execute`, but the server will forward anything
 * string-y to the agent context.
 */
export async function rejectTool(
  payload: ToolPendingPayload,
  session: { session_id: string },
  reason: string,
): Promise<void> {
  const body: MobileResponse = {
    type: "tool_rejected",
    session_id: session.session_id,
    tool_call_id: payload.tool_call_id,
    reason,
  };

  const response = await fetch(buildUrl("/chat/respond"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `[agentSession] POST /chat/respond (reject) failed: ${response.status} ${text}`,
    );
  }
}

/**
 * Exposed for the SSE client so the initial `POST /chat` shares the
 * same URL / header logic. Not part of the public API of this module —
 * import from `./sseClient` instead.
 */
export const __internals = {
  resolveBaseUrl,
  resolveApiKey,
  buildUrl,
  buildHeaders,
};

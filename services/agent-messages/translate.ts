import type { AgentMessage, AgentMessagePart } from "./types";

type ServerTextPart = { type: "text"; text: string };
type ServerToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input?: unknown;
  args?: unknown;
  // task 12 / S2: optional server-marked interrupted timestamp.
  interrupted_at?: string;
};
type ServerToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName?: string;
  output?: { type?: string; value?: unknown } | unknown;
  result?: unknown;
  isError?: boolean;
};

type ServerAssistantPart =
  | ServerTextPart
  | ServerToolCallPart
  | { type: string; [key: string]: unknown };

type ServerToolPart =
  | ServerToolResultPart
  | { type: string; [key: string]: unknown };

export type ServerModelMessage =
  | {
      role: "user";
      content: string | Array<{ type: "text"; text: string }>;
      id?: string;
      created_at?: string;
      createdAt?: string;
    }
  | {
      role: "assistant";
      content: ServerAssistantPart[] | string;
      id?: string;
      created_at?: string;
      createdAt?: string;
    }
  | {
      role: "tool";
      content: ServerToolPart[];
      id?: string;
      created_at?: string;
      createdAt?: string;
    }
  | {
      role: "system";
      content: string | Array<{ type: "text"; text: string }>;
      id?: string;
      created_at?: string;
      createdAt?: string;
    };

function unwrapOutput(output: unknown): unknown {
  if (
    output !== null &&
    typeof output === "object" &&
    "type" in output &&
    (output as { type?: unknown }).type === "json" &&
    "value" in output
  ) {
    return (output as { value: unknown }).value;
  }
  return output;
}

function extractToolResultOutput(part: ServerToolResultPart): {
  output: unknown;
  isError: boolean;
  errorMessage?: string;
} {
  const rawOutput =
    "output" in part && part.output !== undefined ? part.output : part.result;
  const output = unwrapOutput(rawOutput);
  const isError = part.isError === true;
  let errorMessage: string | undefined;
  if (isError) {
    if (typeof output === "string") {
      errorMessage = output;
    } else if (
      output !== null &&
      typeof output === "object" &&
      "error" in output &&
      typeof (output as { error?: unknown }).error === "string"
    ) {
      errorMessage = (output as { error: string }).error;
    } else if (
      output !== null &&
      typeof output === "object" &&
      "message" in output &&
      typeof (output as { message?: unknown }).message === "string"
    ) {
      errorMessage = (output as { message: string }).message;
    }
  }
  return { output, isError, errorMessage };
}

function collectToolResults(
  serverMessages: ServerModelMessage[],
): Map<string, { output: unknown; isError: boolean; errorMessage?: string }> {
  const results = new Map<
    string,
    { output: unknown; isError: boolean; errorMessage?: string }
  >();
  for (const msg of serverMessages) {
    if (msg.role !== "tool") continue;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "tool-result"
      ) {
        const tr = part as ServerToolResultPart;
        if (typeof tr.toolCallId === "string") {
          results.set(tr.toolCallId, extractToolResultOutput(tr));
        }
      }
    }
  }
  return results;
}

function normalizeState(
  state: unknown,
): Extract<AgentMessagePart, { type: "tool" }>["state"] {
  if (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "output-available" ||
    state === "output-error"
  ) {
    if (state === "input-streaming") return "input-available";
    return state;
  }
  return "input-available";
}

function userTextFromContent(
  content: string | Array<{ type: "text"; text: string }>,
): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p.type === "text" ? p.text : ""))
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

function getMessageId(msg: ServerModelMessage, fallbackIndex: number): string {
  if (typeof msg.id === "string" && msg.id) return msg.id;
  return `msg-${fallbackIndex}`;
}

function getCreatedAt(msg: ServerModelMessage): string {
  if (typeof msg.created_at === "string") return msg.created_at;
  if (typeof msg.createdAt === "string") return msg.createdAt;
  return "";
}

export function toAgentMessages(
  serverMessages: ServerModelMessage[],
): AgentMessage[] {
  const toolResults = collectToolResults(serverMessages);
  const out: AgentMessage[] = [];

  for (let i = 0; i < serverMessages.length; i++) {
    const msg = serverMessages[i];

    if (msg.role === "tool") continue;

    if (msg.role === "user") {
      const text = userTextFromContent(msg.content);
      out.push({
        id: getMessageId(msg, i),
        role: "user",
        parts: [{ type: "text", text }],
        createdAt: getCreatedAt(msg),
      });
      continue;
    }

    if (msg.role === "system") {
      const text = userTextFromContent(msg.content);
      out.push({
        id: getMessageId(msg, i),
        role: "system",
        parts: [{ type: "text", text }],
        createdAt: getCreatedAt(msg),
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: AgentMessagePart[] = [];
      const content = msg.content;

      if (typeof content === "string") {
        if (content) parts.push({ type: "text", text: content });
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (!part || typeof part !== "object") continue;
          const type = (part as { type?: unknown }).type;

          if (type === "text") {
            const text = (part as ServerTextPart).text;
            if (typeof text === "string" && text.length > 0) {
              parts.push({ type: "text", text });
            }
            continue;
          }

          if (type === "tool-call") {
            const tc = part as ServerToolCallPart;
            const toolCallId = tc.toolCallId;
            const toolName = tc.toolName;
            if (
              typeof toolCallId !== "string" ||
              typeof toolName !== "string"
            ) {
              continue;
            }
            const input = tc.input !== undefined ? tc.input : tc.args;
            const result = toolResults.get(toolCallId);
            // task 12 / S2: server-marked interrupted hint takes
            // precedence over the absence-of-result heuristic.
            if (!result && typeof tc.interrupted_at === "string") {
              parts.push({
                type: "tool",
                toolCallId,
                toolName,
                input,
                state: "output-error",
                error: "interrupted",
              });
              continue;
            }
            if (result) {
              const part: AgentMessagePart = {
                type: "tool",
                toolCallId,
                toolName,
                input,
                output: result.output,
                state: result.isError ? "output-error" : "output-available",
                ...(result.errorMessage ? { error: result.errorMessage } : {}),
              };
              parts.push(part);
            } else {
              parts.push({
                type: "tool",
                toolCallId,
                toolName,
                input,
                state: "input-available",
              });
            }
            continue;
          }

          if (type === "tool") {
            const live = part as {
              toolCallId?: unknown;
              toolName?: unknown;
              input?: unknown;
              output?: unknown;
              state?: unknown;
              error?: unknown;
            };
            if (
              typeof live.toolCallId === "string" &&
              typeof live.toolName === "string"
            ) {
              const state = normalizeState(live.state);
              const tp: AgentMessagePart = {
                type: "tool",
                toolCallId: live.toolCallId,
                toolName: live.toolName,
                input: live.input,
                ...(live.output !== undefined ? { output: live.output } : {}),
                state,
                ...(typeof live.error === "string"
                  ? { error: live.error }
                  : {}),
              };
              parts.push(tp);
            }
          }
        }
      }

      out.push({
        id: getMessageId(msg, i),
        role: "assistant",
        parts,
        createdAt: getCreatedAt(msg),
      });
    }
  }

  return out;
}

export type AgentMessagePart =
  | { type: "text"; text: string }
  | {
      type: "tool";
      toolName: string;
      toolCallId: string;
      input: unknown;
      output?: unknown;
      state:
        | "input-streaming"
        | "input-available"
        | "output-available"
        | "output-error";
      error?: string;
    };

export type AgentMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: AgentMessagePart[];
  createdAt: string;
};

type _AssertRoleNarrowed = AgentMessage["role"] extends
  | "user"
  | "assistant"
  | "system"
  ? true
  : false;
type _AssertStateNarrowed = Extract<
  AgentMessagePart,
  { type: "tool" }
>["state"] extends
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  ? true
  : false;

const _roleCheck: _AssertRoleNarrowed = true;
const _stateCheck: _AssertStateNarrowed = true;
void _roleCheck;
void _stateCheck;

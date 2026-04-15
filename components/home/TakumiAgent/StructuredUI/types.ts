import type React from "react";
import type { AgentMessagePart } from "@/services/agent-messages/types";

export type ToolComponentProps<Input, Output> = {
  state: Extract<AgentMessagePart, { type: "tool" }>["state"];
  input: Input;
  output?: Output;
  error?: string;
  mode: "live" | "historical";
  addToolResult?: (output: Output) => void;
};

export type ToolComponent<Input, Output> = React.ComponentType<
  ToolComponentProps<Input, Output>
>;

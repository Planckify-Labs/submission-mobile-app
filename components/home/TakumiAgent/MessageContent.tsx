import React from "react";
import { View } from "react-native";
import type { AgentMessage } from "@/services/agent-messages/types";
import MarkdownMessage from "./MarkdownMessage";
import PlainTextMessage from "./PlainTextMessage";
import { toolComponents } from "./StructuredUI";

interface MessageContentProps {
  message: AgentMessage;
  mode: "live" | "historical";
  addToolResult?: (toolCallId: string, output: unknown) => void;
}

const MessageContent: React.FC<MessageContentProps> = React.memo(
  ({ message, mode, addToolResult }) => {
    const isUser = message.role === "user";

    return (
      <View>
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return <PlainTextMessage key={`text-${i}`} content={part.text} />;
            }
            return <MarkdownMessage key={`text-${i}`} content={part.text} />;
          }

          if (part.type === "tool") {
            const Component = toolComponents[part.toolName];
            if (!Component) return null;
            const liveCallback =
              mode === "live" && addToolResult
                ? (output: unknown) => addToolResult(part.toolCallId, output)
                : undefined;
            return (
              <Component
                key={part.toolCallId}
                state={part.state}
                input={part.input}
                output={part.output}
                error={part.error}
                mode={mode}
                addToolResult={liveCallback}
              />
            );
          }

          return null;
        })}
      </View>
    );
  },
);

MessageContent.displayName = "MessageContent";

export default MessageContent;

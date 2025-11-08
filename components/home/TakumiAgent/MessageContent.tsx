import { UIMessage } from "ai";
import React from "react";
import { extractTextContent } from "./extractTextContent";
import MarkdownMessage from "./MarkdownMessage";
import PlainTextMessage from "./PlainTextMessage";

interface MessageContentProps {
  message: UIMessage;
  isUser: boolean;
}

const MessageContent: React.FC<MessageContentProps> = React.memo(
  ({ message, isUser }) => {
    const textContent = extractTextContent(message);

    if (isUser) {
      return <PlainTextMessage content={textContent} />;
    }

    return <MarkdownMessage content={textContent} />;
  },
);

MessageContent.displayName = "MessageContent";

export default MessageContent;

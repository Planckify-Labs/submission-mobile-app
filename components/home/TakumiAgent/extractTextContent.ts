import { UIMessage } from "ai";

export const extractTextContent = (message: UIMessage): string => {
  if (!message.parts || !Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .map((part) => {
      switch (part.type) {
        case "text":
        case "reasoning":
          return part.text;
        default:
          return undefined;
      }
    })
    .filter(Boolean)
    .join("\n\n");
};

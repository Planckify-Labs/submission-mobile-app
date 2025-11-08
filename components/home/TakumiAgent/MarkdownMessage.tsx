import React from "react";
import { StyleSheet, Text } from "react-native";
import Markdown from "react-native-markdown-display";
import { useMarkdownStyles } from "./useMarkdownStyles";

interface MarkdownMessageProps {
  content: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  const markdownStyles = useMarkdownStyles();

  try {
    return (
      <Markdown style={markdownStyles as StyleSheet.NamedStyles<any>}>
        {content || "This message includes content we can't display yet."}
      </Markdown>
    );
  } catch (error) {
    console.error("Markdown rendering error:", error);
    return (
      <Text className="text-sm leading-5 text-light-matte-black">
        {content || "This message includes content we can't display yet."}
      </Text>
    );
  }
};

export default MarkdownMessage;

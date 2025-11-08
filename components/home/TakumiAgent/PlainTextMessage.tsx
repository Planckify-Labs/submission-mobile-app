import React from "react";
import { Text } from "react-native";

interface PlainTextMessageProps {
  content: string;
}

const PlainTextMessage: React.FC<PlainTextMessageProps> = ({ content }) => {
  return (
    <Text className="text-sm leading-5 text-white">
      {content || "This message includes content we can't display yet."}
    </Text>
  );
};

export default PlainTextMessage;

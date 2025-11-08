import { useMemo } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";

interface MarkdownStyles {
  body?: StyleProp<TextStyle>;
  heading1?: StyleProp<TextStyle>;
  heading2?: StyleProp<TextStyle>;
  heading3?: StyleProp<TextStyle>;
  heading4?: StyleProp<TextStyle>;
  heading5?: StyleProp<TextStyle>;
  heading6?: StyleProp<TextStyle>;
  code_inline?: StyleProp<TextStyle>;
  code_block?: StyleProp<TextStyle>;
  fence?: StyleProp<TextStyle>;
  link?: StyleProp<TextStyle>;
  list_item?: StyleProp<ViewStyle>;
  bullet_list?: StyleProp<ViewStyle>;
  ordered_list?: StyleProp<ViewStyle>;
  blockquote?: StyleProp<ViewStyle>;
  paragraph?: StyleProp<TextStyle>;
  strong?: StyleProp<TextStyle>;
  em?: StyleProp<TextStyle>;
  hr?: StyleProp<ViewStyle>;
}

export const useMarkdownStyles = (): MarkdownStyles => {
  return useMemo(
    () => ({
      body: {
        color: "#20222c",
        fontSize: 14,
        lineHeight: 20,
      },

      heading1: {
        fontSize: 20,
        fontWeight: "700",
        color: "#20222c",
        marginTop: 12,
        marginBottom: 8,
        lineHeight: 28,
      },
      heading2: {
        fontSize: 18,
        fontWeight: "600",
        color: "#20222c",
        marginTop: 10,
        marginBottom: 6,
        lineHeight: 24,
      },
      heading3: {
        fontSize: 16,
        fontWeight: "600",
        color: "#20222c",
        marginTop: 8,
        marginBottom: 4,
        lineHeight: 22,
      },
      heading4: {
        fontSize: 15,
        fontWeight: "600",
        color: "#20222c",
        marginTop: 6,
        marginBottom: 4,
        lineHeight: 20,
      },
      heading5: {
        fontSize: 14,
        fontWeight: "600",
        color: "#20222c",
        marginTop: 4,
        marginBottom: 2,
        lineHeight: 18,
      },
      heading6: {
        fontSize: 13,
        fontWeight: "600",
        color: "#20222c",
        marginTop: 4,
        marginBottom: 2,
        lineHeight: 18,
      },

      code_inline: {
        backgroundColor: "#f5f5f5",
        color: "#c71c4b",
        fontFamily: "monospace",
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 13,
      },

      code_block: {
        backgroundColor: "#f5f5f5",
        color: "#20222c",
        fontFamily: "monospace",
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        fontSize: 13,
        lineHeight: 18,
      },

      fence: {
        backgroundColor: "#f5f5f5",
        color: "#20222c",
        fontFamily: "monospace",
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        fontSize: 13,
        lineHeight: 18,
      },

      link: {
        color: "#c71c4b",
        textDecorationLine: "underline",
      },

      list_item: {
        marginVertical: 4,
        flexDirection: "row",
      },
      bullet_list: {
        marginVertical: 8,
      },
      ordered_list: {
        marginVertical: 8,
      },

      blockquote: {
        backgroundColor: "#f9f9f9",
        borderLeftWidth: 4,
        borderLeftColor: "#c71c4b",
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 8,
      },

      paragraph: {
        marginVertical: 4,
        lineHeight: 20,
      },

      strong: {
        fontWeight: "700",
        color: "#20222c",
      },

      em: {
        fontStyle: "italic",
        color: "#20222c",
      },

      hr: {
        backgroundColor: "#e0e0e0",
        height: 1,
        marginVertical: 12,
      },
    }),
    [],
  );
};

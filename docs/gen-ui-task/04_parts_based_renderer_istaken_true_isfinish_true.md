# Task 04 — Rewrite `MessageContent` as a parts iterator

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.3

## Why this matters

Today `MessageContent.tsx:17-45` calls `extractTextContent` and
`extractToolCalls` separately, which **loses part ordering** — a tool
emitted between two paragraphs of text ends up in the wrong place. The
parts iterator is the render-side half of the "pure function of
`message.parts`" contract (§2 principle 3) that makes live and historical
rendering collapse into the same code path.

## Scope

Replace the body of `components/home/TakumiAgent/MessageContent.tsx` with
a parts iterator that walks `message.parts` in order:

```tsx
import { toolComponents } from './StructuredUI';

type Props = {
  message: AgentMessage;
  mode: 'live' | 'historical';
  addToolResult?: (toolCallId: string, output: unknown) => void;
};

export function MessageContent({ message, mode, addToolResult }: Props) {
  return (
    <View>
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          return <MarkdownMessage key={i} text={part.text} />;
        }
        if (part.type === 'tool') {
          const Component = toolComponents[part.toolName];
          if (!Component) return null; // silent by default
          return (
            <Component
              key={part.toolCallId}
              state={part.state}
              input={part.input}
              output={part.output}
              error={part.error}
              mode={mode}
              addToolResult={
                mode === 'live' && addToolResult
                  ? (output) => addToolResult(part.toolCallId, output)
                  : undefined
              }
            />
          );
        }
        return null;
      })}
    </View>
  );
}
```

## Rules (non-negotiable)

- **Preserve ordering.** Iterate `message.parts` once, top to bottom. Do
  not group, sort, or split parts.
- **Key tool parts by `toolCallId`.** Stable across re-renders; text parts
  can key by index.
- **Silent fallback.** `Component` missing → `return null`. No "unknown
  tool" placeholder in production.
- **Do not inspect `state` here.** Mode + state handling is the
  component's job. The renderer only picks which component to instantiate.
- **`addToolResult` only in live mode.** Pass `undefined` in historical —
  a historical component that tries to call it will crash loudly, which
  is the correct failure mode (§2 principle 4).

## Acceptance

- [ ] `MessageContent` takes `message: AgentMessage`, `mode`, optional `addToolResult`.
- [ ] No calls to `extractTextContent` or `extractToolCalls` remain in this file.
- [ ] Rendering order matches `message.parts` order exactly (unit or snapshot test covers interleaved text/tool cases).
- [ ] Passes `pnpm check:syntax` and `pnpm lint`.

## Out of scope

- Actually adopting `AgentMessage` in the live session (task 08 wires that up).
- Deleting the `extractToolCalls` / `extractTextContent` files (task 08 — they may still be referenced).
- Any new card components (tasks 05, 06, 09, 10).

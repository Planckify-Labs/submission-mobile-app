# Task 01 — `AgentMessage` / `AgentMessagePart` types

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.1 "Client data shape"

## Why this matters

Today the client stores chat as `{ id, role, text }` (`AgentMode.tsx:73-77`)
and `StoredMessage.content: string` (`useConversations.ts:15-20`). That shape
throws away every tool-call and tool-result part the server already persists,
which is why historical conversations can only render as text transcripts.

Introducing `AgentMessage` is the foundation for everything downstream —
registry rendering (task 03), parts iterator (task 04), and parts-aware
history (task 08) all type against this shape.

## Scope

Create `services/agent-messages/types.ts` exporting:

```ts
export type AgentMessagePart =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      toolName: string;
      toolCallId: string;
      input: unknown;
      output?: unknown;
      state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
      error?: string;
    };

export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentMessagePart[];
  createdAt: string;
};
```

## Rules (non-negotiable)

- **Parts-first.** `parts` is authoritative; any `text` accessor becomes a
  derived helper, not a stored field.
- **`system` role is the Mobile voice.** Reserved for out-of-band frames
  around security-critical modals (see §4.1). Most tool execution lives in
  `assistant` messages as `tool` parts.
- **State values match the spec verbatim.** `'input-streaming'` is a
  live-only transient; historical data never carries it.
- **Do not leak server shapes.** `ModelMessage` with `content: 'tool-result'
  -> output: { type: 'json', value }` is the server's concern; tasks 02 and
  08 translate it. This module has no dependency on server types.

## Acceptance

- [ ] `services/agent-messages/types.ts` exists and exports the two types exactly as above.
- [ ] Module is types-only — no runtime code, no imports from `api/` or server DTOs.
- [ ] A type-level test (e.g. `tsd` or a dev-only `assertType` file) confirms `state` is a string-literal union and `role` is narrowed to the three values.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Translating server messages into this shape (task 02).
- Using the type in any component (tasks 03–08).

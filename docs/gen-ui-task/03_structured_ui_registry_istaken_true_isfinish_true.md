# Task 03 — `StructuredUI/` tool→component registry

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.2, §4.2.1

## Why this matters

Today the `StructuredUI/` folder is empty. Each live card is a bespoke
branch somewhere in `AgentMode.tsx` or `MessageContent.tsx`. The whole
point of the refactor is a **single rule**: if a tool has a component in
the registry, render it. If not, it's silent. That rule is what makes
"adding a generative UI surface" a one-line change (§11 success criteria).

## Scope

Create the folder layout:

```
components/home/TakumiAgent/StructuredUI/
  index.ts           — re-exports toolComponents, types
  types.ts           — ToolComponent<Input, Output>, ToolComponentProps
  registry.ts        — toolComponents: Record<string, ToolComponent<any, any>>
  cards/             — empty for now; tasks 05, 06, 09, 10 add real cards
```

`types.ts`:

```ts
import type { AgentMessagePart } from '@/services/agent-messages/types';

export type ToolComponentProps<Input, Output> = {
  state: Extract<AgentMessagePart, { type: 'tool' }>['state'];
  input: Input;
  output?: Output;
  error?: string;
  mode: 'live' | 'historical';
  addToolResult?: (output: Output) => void;
};

export type ToolComponent<Input, Output> =
  React.ComponentType<ToolComponentProps<Input, Output>>;
```

`registry.ts`:

```ts
export const toolComponents: Record<string, ToolComponent<any, any>> = {};
```

## Rules (non-negotiable)

- **Registry IS the UI contract.** No `display` field, no `chip` vs `card`
  enum, no visibility flag. Absent from registry = silent.
- **No production fallback.** `GenericToolCard` may exist *only* gated by
  `__DEV__`. Production must render `null` for unregistered tools so
  agent-only tools stay invisible (§4.2).
- **Components own everything.** The renderer does not wrap, style, or
  otherwise decorate what a component returns. A tool can render a chip,
  a full-width card, a banner, or a bottom sheet — that's the component's
  call.
- **Historical branch is mandatory.** Every component registered here
  must render deterministically from `input` + `output` when
  `mode === 'historical'`. No timers, no polling, no subscriptions,
  no `Date.now()`. This is what makes replay work.

## Acceptance

- [ ] Files above exist and compile.
- [ ] `toolComponents` is exported as a plain `Record` with string keys (no enum, no class).
- [ ] `ToolComponentProps` types `addToolResult` as optional — defined only in live mode.
- [ ] `index.ts` re-exports `toolComponents` and the `ToolComponent` / `ToolComponentProps` types.
- [ ] If `GenericToolCard` is added, it is only referenced behind `if (__DEV__)` and not registered in production.

## Out of scope

- Writing any card components (tasks 05, 06, 09, 10).
- Changing `MessageContent.tsx` (task 04).

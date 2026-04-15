# Task 02 — Server ↔ client message translator

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.1, §7.2

## Why this matters

The server persists `ModelMessage.content[]` with `'tool-call'` parts on
assistant messages and `'tool-result'` parts on `role:'tool'` messages,
wrapping outputs as `{ type: 'json', value }` (see
`takumi-agent-api/src/chat.service.ts:262-278` and `:838-866`). The client
needs a single flattened shape (`AgentMessage` from task 01) that pairs
each tool call with its result by `toolCallId`. Without this translator,
historical conversations still cannot render tool cards.

The spec is explicit that translation lives on the client so the server's
API shape stays stable for non-mobile consumers (§12 open question —
leaning "client").

## Scope

Create `services/agent-messages/translate.ts` exporting:

```ts
export function toAgentMessages(serverMessages: ModelMessage[]): AgentMessage[];
```

Behavior:

1. Walk `serverMessages` in order.
2. For each `assistant` message, emit one `AgentMessage` whose `parts`
   preserve the original ordering of `text` and `tool-call` entries.
3. For each `tool-call` part, look ahead for the matching `role:'tool'`
   message carrying a `tool-result` with the same `toolCallId`; merge
   its `output.value` into the tool part.
4. Derive `state`:
   - matched output → `'output-available'`
   - matched output with an error flag → `'output-error'` (also populate `error`)
   - unmatched tool-call → `'input-available'` (the client will render as
     **"⚠︎ Interrupted"** per §8)
5. Drop the standalone `role:'tool'` messages from the output — they've
   been folded into their assistant parent.
6. `user` messages become single-part `text` messages.

## Rules (non-negotiable)

- **Pure function.** No I/O, no dates-derived-from-now, no global state.
  Same input → same output. This is what makes replay deterministic.
- **`input-streaming` never appears.** That state is live-only (§4.1);
  historical data can't carry it. If you encounter it in a stored
  message, coerce to `'input-available'`.
- **Unwrap `output: { type: 'json', value }`.** The client stores the
  bare `value`. Don't leak the wrapper.
- **Order matters.** Tool cards must render in the exact position the
  model emitted them; do not reorder text/tool parts.

## Acceptance

- [ ] `toAgentMessages` handles: pure-text turn, text+tool turn, multi-tool turn, orphaned tool-call (interrupted), sanitized/redacted output.
- [ ] Unit tests cover each case in a fixture-driven way (input JSON → expected `AgentMessage[]`).
- [ ] No imports from React, React Native, or any store.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Wiring the translator into the resume flow (task 08).
- Modifying the server output shape (that's non-goal §9).

# Task 07 — `streamingMessageId` + `resolveMode`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.4, §7.1 M10

## Why this matters

The registry renderer (task 04) and every migrated card (tasks 05, 06)
take a `mode: 'live' | 'historical'` prop, but nothing currently
computes it. Without this task, we'd have to ship an ad-hoc heuristic
per screen — the spec is explicit that there's exactly one rule:

> The single source of truth for "live" is: *"is this the message
> currently being streamed in the active session?"* Nothing else is
> live.

## Scope

1. Add `streamingMessageId: string | null` to the agent session state
   (`agentSession.ts`). Set it to the assistant message id the moment
   the SSE stream for that turn starts; clear it to `null` when the
   turn emits `done` or the stream errors out.
2. Plumb `streamingMessageId` into `AgentMode.tsx` where messages are
   rendered.
3. Add `services/agent-messages/resolveMode.ts`:

```ts
export function resolveMode(
  message: AgentMessage,
  streamingMessageId: string | null,
): 'live' | 'historical' {
  if (message.id === streamingMessageId) return 'live';
  return 'historical';
}
```

4. `MessageContent` callers compute `mode` via `resolveMode` and pass
   it down.

## Rules (non-negotiable)

- **Single rule.** `message.id === streamingMessageId` is the only
  condition that yields `'live'`. Do not add "recent", "pending",
  "local-only", or timestamp-based tiebreakers.
- **Reconnect preserves live.** If the SSE stream reconnects via
  `buildReconnectResponse` (§8 "User reopens an active session
  mid-turn"), `streamingMessageId` must remain the same id — the turn
  is continuing, not restarting.
- **Clear eagerly on done/error.** A stale `streamingMessageId` would
  keep a finished message in live mode forever and potentially re-fire
  effects.
- **Nothing derived from `Date.now()`.** Mode is determined by identity
  only.

## Acceptance

- [ ] `streamingMessageId` lives in `agentSession.ts`, is set on stream-start, and cleared on `done` / error / unmount.
- [ ] `resolveMode` unit test: returns `'live'` iff ids match, else `'historical'`.
- [ ] `AgentMode.tsx` renders every message with an explicit `mode` computed via `resolveMode`.
- [ ] Reconnect flow: a mid-turn reload keeps the streaming assistant message in live mode; all prior messages are historical.

## Out of scope

- Making history load parts-aware (task 08).
- Any card-level logic — cards already branch on `mode` from tasks 05, 06.

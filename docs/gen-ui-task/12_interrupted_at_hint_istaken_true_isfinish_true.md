# Task 12 — Server-side `interrupted_at` hint on reconnect (S2, optional)

**Status:** Not taken (optional — non-blocking)
**Owner:** Server (takumi-agent-api)
**Spec reference:** `generative-ui-spec.md` §7.2 S2, §12 open question

## Why this matters

Today the client infers "interrupted" from the *absence* of a matching
`tool-result` (task 02). That heuristic works but:

- it can't distinguish "interrupted" from "still running and the user
  just reconnected faster than the result landed";
- it forces a time-based UI decision the server already knows better.

S2 lets the server explicitly mark a tool-call as dead when it replays
pending state via `buildReconnectResponse`, so the client can render
`⚠︎ Interrupted` deterministically instead of guessing.

Do only if orphan detection on the client proves too flaky in
practice — the spec marks this as "suggested, not blocking."

## Scope

1. When `buildReconnectResponse` replays `tool_pending` events on an
   SSE reconnect, include an `interrupted_at` ISO timestamp (or
   explicit `state: 'output-error'`) on tool-calls that the server
   knows are dead (e.g. the backing process exited, a deadline
   elapsed, the mobile executor never acked).
2. Propagate the hint through to `contentJson` persistence so the
   next history fetch carries the same marker.
3. Translator (`services/agent-messages/translate.ts` from task 02)
   reads the hint and sets `state: 'output-error'` + `error: 'interrupted'`
   on the client part.

## Rules (non-negotiable)

- **Additive wire shape.** New optional field on the tool-call part —
  no breaking changes to existing clients.
- **Don't invent timeouts arbitrarily.** The server only marks dead
  what it can prove is dead. Live-but-slow tools stay `'input-available'`.
- **Same sanitization path.** `interrupted_at` is metadata, not user
  data, but it still flows through the same write path.

## Acceptance

- [ ] Tool-calls marked `interrupted_at` render as `⚠︎ Interrupted` in historical mode with a timestamp source the client can trust.
- [ ] Live reconnect of a still-running tool does **not** add the hint; the card continues its live progression.
- [ ] Non-mobile consumers that ignore the new field still work.

## Out of scope

- Persist partial turns (task 11).
- Any broader retry / resume protocol changes — orthogonal.

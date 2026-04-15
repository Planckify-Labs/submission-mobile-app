# Task 11 — Persist partial turns on SSE disconnect (S1, optional)

**Status:** Not taken (optional — non-blocking)
**Owner:** Server (takumi-agent-api)
**Spec reference:** `generative-ui-spec.md` §3.1, §7.2 S1

## Why this matters

Today's server only persists turn state in the clean-idle branch at
`src/chat.service.ts:280-293` — the `toolCalls.length === 0` early
return. A mid-turn crash, process restart, or client disconnect leaves
in-progress `tool-call` parts unsaved, which shows up on reload as:
turn looks cleanly completed, but one tool silently vanished.

The spec calls this out as "⚠️ Persistence is end-of-turn only" and
marks S1 as a **suggested, non-blocking** improvement. Ship only if
orphan churn is observed in practice.

## Scope

1. Persist assistant `ModelMessage.content[]` **incrementally** as
   each `tool-call` part is emitted — don't wait for the clean-idle
   branch.
2. On SSE disconnect / request abort, flush the current partial
   message to Prisma before releasing the connection.
3. Keep the end-of-turn write idempotent; repeated saves of the same
   message id should upsert, not duplicate.

## Rules (non-negotiable)

- **Non-blocking for mobile.** This task does not change the wire
  shape — client behavior is unchanged. The only observable difference
  is that interrupted turns reload with the correct set of parts
  instead of appearing cleanly done.
- **Same sanitization rules.** Partial writes must still go through
  `sanitizeMessages` (§3.1). Don't carve a fast path that bypasses it.
- **Do not change the `contentJson` shape.** §9 non-goals — no new
  `parts` table.

## Acceptance

- [ ] Kill the server mid-turn after a `tool-call` part is emitted; reload the conversation — the partial assistant message is present with the unresolved tool-call part.
- [ ] On normal completion, the final persisted content matches the pre-change behavior byte-for-byte (no dupes, no reordering).
- [ ] `sanitizeMessages` still runs on every write path.

## Out of scope

- `interrupted_at` hint (task 12).
- Any mobile client changes — orphan-detection on the client is already covered in tasks 02 and 08.

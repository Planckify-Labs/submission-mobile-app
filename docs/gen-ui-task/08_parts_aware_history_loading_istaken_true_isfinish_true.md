# Task 08 — `fromStoredMessage` parts-aware + remove extractors

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §6, §7.1 M8 + M9

## Why this matters

This is **the flip point** (§10 step 4). Everything before this task is
invisible scaffolding — the live path still works the same, history
still renders as text. After this task lands, reopening an old
conversation renders the real cards in their historical form. This is
also where the regression risk is highest.

Today's bugs we're killing:

- `hooks/queries/useConversations.ts:15-20` — `StoredMessage.content`
  is typed as `string`, so tool parts are silently dropped in the type
  system before they even reach render.
- `AgentMode.tsx:104-111` — `fromStoredMessage` maps `role: 'tool'` →
  `'assistant'` and throws away `content` parts.
- `MessageContent.tsx` still calls `extractToolCalls` /
  `extractTextContent` at any remaining call sites.

## Scope

1. **Update `StoredMessage`** (`hooks/queries/useConversations.ts:15-20`)
   so `content` carries the server's `ModelMessage.content[]` shape —
   or a pre-translated `AgentMessage.parts` if you prefer to translate
   in the query's `select`. Pick one layer; don't translate twice.
2. **Rewrite `fromStoredMessage`** (`AgentMode.tsx:104-111`) to call
   `toAgentMessages` (task 02) on the stored conversation and return
   `AgentMessage[]`.
3. **Remove tool→assistant role collapsing.** `role: 'tool'` messages
   have already been folded into their assistant parent by the
   translator; the resume path just consumes `AgentMessage[]` as-is.
4. **Remove remaining call sites** of `extractToolCalls.ts` and
   `extractTextContent.ts`. If nothing else imports them, delete the
   files (§7.1 M9: "keep the helpers only if still referenced
   elsewhere").
5. **Wire `resolveMode`** (task 07) at the resume path — every
   message loaded from history resolves to `'historical'` because
   `streamingMessageId` is `null` until the user sends a new message.

## Rules (non-negotiable)

- **History is read-only.** No tool re-fires on load, no approval
  modals reopen, no polling starts. §2 principle 4.
- **Orphaned tool calls render as `⚠︎ Interrupted`.** The translator
  already marks them `'input-available'`; card components must handle
  that state in their historical branch by showing the interrupted
  receipt. §8 edge case.
- **Do not mutate stored data on load.** Translation is pure; the
  cached server response stays as-is.
- **Explorer links are allowed** even in historical mode — they're
  read-only outbound actions (§8).

## Acceptance

- [ ] Reopening any conversation ≥ 24h old renders the same cards the user saw live, in the same order, with no interactive affordances (§11 success criteria).
- [ ] Zero `useEffect` in card components fires when `mode === 'historical'` (add dev-only assertion in each migrated card; remove before merge).
- [ ] `extractToolCalls.ts` / `extractTextContent.ts` either deleted or confined to unrelated code paths.
- [ ] No crash when a historical message has an orphaned tool-call (interrupted case).
- [ ] QA script: send a live transaction, close the app, reopen — the tx card appears in history with the same final status and no network calls on render.

## Out of scope

- `SpendingApprovalModal` → `SpendingApprovalCard` migration (task 09).
- New tools (task 10).
- Server changes (tasks 11, 12).

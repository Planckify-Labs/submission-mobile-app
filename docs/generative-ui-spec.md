# Generative UI — Engineering Spec (Additive)

**Status:** Draft
**Owner:** Agent team
**Scope:** `takumiaiwallet/mobile-app` (client) + minimal contract notes for `takumi-agent-api` (server)
**Date:** 2026-04-15

---

## 1. Goal

Level the agent chat up from **"cards that happen to appear after text"** to **proper generative UI**, where the model itself selects which UI component renders by selecting a tool. The refactor is **additive**: existing live-mode cards (`PendingTxCard`, `PreviewCard`, `ApprovalSheet`) and their UX stay intact. We add the pieces needed for (a) a registry-driven renderer and (b) read-only replay of historical conversations.

## 2. Guiding principles (non-negotiable)

1. **Three entities, three voices.** The chat is a conversation between:
   - **User** — request (input bubbles)
   - **Agent** — thinking & talking (text + tool requests)
   - **Mobile** — executer (cards that narrate tool execution and optionally accept input)
2. **Mobile must keep narrating during live turns.** Spinners, progress hints, countdowns, pending states, interactive affordances — all stay. A silent executor breaks the metaphor.
3. **Rendering is a pure function of `message.parts`.** No side-effect-derived state. Same parts in → same UI out. This is what makes replay work.
4. **History is read-only.** Historical parts render their **terminal form only**. No re-firing tools, no re-polling, no re-opening approval prompts. If the user wants to act again, they type a new message.
5. **Live ≠ replay.** Each card component has two render branches gated by a `mode: 'live' | 'historical'` prop. The live branch keeps today's behaviour; the historical branch shows a frozen receipt.
6. **Interaction never dead-ends in a modal.** Decisions made in live mode must be persisted back into the tool's `output` so they survive reload as part of the historical receipt. Modals are reserved for security-critical gates (seed reveal, signing) and always leave a trailing "system" bubble capturing the outcome.

## 3. Current state audit

### 3.1 Server (`takumi-agent-api`) — mostly ready

| Concern | Status | Reference |
|---|---|---|
| Prisma stores full message parts | ✅ | `prisma/schema.prisma:28` — `Message.contentJson: Json` |
| Assistant tool-call parts persisted | ✅ | `src/chat.service.ts:262-278` (pushes `{type:'tool-call', toolCallId, toolName, input}` into `content[]`) |
| Tool-result parts persisted | ✅ | `src/chat.service.ts:838-866` (`toolResultMessage` returns `role:'tool'` with `{type:'tool-result', ..., output:{type:'json', value}}`) |
| History endpoint returns raw parts | ✅ | `src/history/conversations.controller.ts:104-108` — `content: m.contentJson` |
| Sanitization keeps structure | ✅ | `src/history/sanitize-messages.ts` redacts sensitive field values only |
| Persistence is end-of-turn only | ⚠️ | `src/chat.service.ts:280-293` — only persists on `toolCalls.length === 0` branch. Mid-turn crashes or disconnects lose in-progress parts. |
| No explicit `state` column | ⚠️ | State is implicit: pair `tool-call` with matching `tool-result` by `toolCallId`. Orphans = "interrupted". |

**Conclusion:** the server is structurally sound. Two small gaps are called out under §7.

### 3.2 Client (`mobile-app`) — the leveling-up happens here

| Concern | Status | Reference |
|---|---|---|
| Live tool cards work well | ✅ | `PendingTxCard/`, `PreviewCard/`, `ApprovalSheet` |
| Tool telemetry inline | ✅ | `ToolCallDisplay.tsx` |
| Parts-based rendering | ❌ | `MessageContent.tsx:17-45` splits into `extractTextContent` + `extractToolCalls`, losing part ordering |
| `ChatMessage` type preserves parts | ❌ | `AgentMode.tsx:73-77` — `{id, role, text}` only; tool parts dropped |
| Stored history preserves parts | ❌ | `hooks/queries/useConversations.ts:15-20` — `StoredMessage.content: string`; `raw` is unused in render path |
| `fromStoredMessage` collapses tool msgs | ❌ | `AgentMode.tsx:104-111` — maps `role:'tool'` → `'assistant'`, drops `content` parts |
| Live card state is runtime-only | ❌ | `pendingTxStore`, `inlinePreview`, `approvalState` are ephemeral React/MMKV state, not serialized into the conversation log |
| Tool→component registry | ❌ | `StructuredUI/` is empty |
| Historical replay = live replay | ❌ | Resume path only restores text bubbles |

**The critical finding:** the server already persists everything we need. The mobile app currently treats history as a **text transcript** and uses live-only runtime state for all cards. We don't need server changes for the core spec — just stop throwing away parts on the client.

## 4. Target architecture

### 4.1 Client data shape

Introduce `AgentMessage` — a superset of today's `ChatMessage`:

```ts
type AgentMessagePart =
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      toolName: string;
      toolCallId: string;
      input: unknown;                     // always present once model committed
      output?: unknown;                   // present once executor resolved
      state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
      error?: string;                     // present when state === 'output-error'
    };

type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';  // 'system' = mobile/executor frames
  parts: AgentMessagePart[];
  createdAt: string;
};
```

`system` role is the Mobile entity's voice — used for out-of-band frames we emit from the client (e.g. "Approval requested" → "Approved" pair around a modal that can't be inlined). Optional; most tool execution renders inside `assistant` messages as `tool` parts.

### 4.2 Tool → component registry

**The single rule:** if a tool has a component in the registry, render it. If not, it's silent — the agent still sees the result in its context, the user sees nothing.

```tsx
const Component = toolComponents[part.toolName];
if (!Component) return null;           // no UI registered → silent
return <Component {...part} mode={mode} />;
```

No `display` field, no `chip` vs `card` enum, no visibility flag. The registry itself is the UI contract:

- **Add a UI for a tool** = write a component + add one line to the registry.
- **Remove a UI** = delete the registration.
- **Agent-only tool** = don't register anything. The model still sees the result and reasons over it; the user just doesn't see a visual artifact.

Layout:

```
components/home/TakumiAgent/StructuredUI/
  index.ts                 — exports toolComponents, types
  types.ts                 — ToolComponent<Input, Output>
  registry.ts              — toolComponents: Record<string, ToolComponent<any,any>>
  cards/
    PendingTxCard.tsx      — mode-aware (migrated from ../PendingTxCard)
    PreviewCard.tsx        — mode-aware (migrated from ../PreviewCard)
    SpendingApprovalCard.tsx  — new: inline replacement for SpendingApprovalModal
    SwapQuoteCard.tsx      — new: first fresh first-class card to prove the pattern
```

Note: `GenericToolCard` is intentionally **not** part of the default path. Keep it only as a dev-build diagnostic (e.g. gated behind `__DEV__`) to help debug unregistered tools. In production, unregistered = silent.

### 4.2.1 Component contract

Every registered component receives:

```ts
type ToolComponentProps<Input, Output> = {
  state: AgentMessagePart['state'];    // input-available | output-available | output-error
  input: Input;
  output?: Output;
  error?: string;
  mode: 'live' | 'historical';
  addToolResult?: (output: Output) => void;  // only defined in live mode
};
```

The renderer doesn't care what the component returns — chip, card, banner, bottom sheet, inline badge, full takeover. That's entirely the component's decision. Two tools can render wildly different UIs; the chat thread is just a vertical list of whatever the components chose to produce.

**Rules inside the component:**

- `mode === 'historical'` → render a **terminal receipt** derived purely from `input` + `output`. No timers, no polling, no `addToolResult`, no subscriptions, no `Date.now()`, no external state reads.
- `mode === 'live'` → render the full expressive/interactive UI. Progressive states, countdowns, buttons, polling — all allowed.
- Branch on `mode` first, then on `state`. The historical branch must be reachable with `input`/`output` alone; if a component can't render historically without network/store access, its output shape is wrong and should be enriched.

### 4.2.2 Live vs historical walkthrough

Same component, two moments in its life. Example: `SpendingApprovalCard`.

```tsx
function SpendingApprovalCard({ state, input, output, mode, addToolResult }) {
  // HISTORICAL — always a frozen receipt, never interactive
  if (mode === 'historical') {
    return output?.decision === 'approved'
      ? <Receipt>✓ Approved · {input.amount} {input.token}</Receipt>
      : <Receipt>✗ Rejected</Receipt>;
  }

  // LIVE — interactive until resolved, then receipt
  if (state === 'output-available') {
    return <Receipt>✓ Approved · {input.amount} {input.token}</Receipt>;
  }
  return (
    <InteractiveCard>
      <Text>Approve {input.amount} {input.token}?</Text>
      <Button onPress={() => addToolResult!({ decision: 'approved' })}>Approve</Button>
      <Button onPress={() => addToolResult!({ decision: 'rejected' })}>Reject</Button>
    </InteractiveCard>
  );
}
```

**Live moment:**

1. Agent emits `tool_pending` for `approveSpending`. Renderer sees a part with `state:'input-available'`, looks up the component, passes `mode:'live'`.
2. Card renders **Approve / Reject** buttons.
3. User taps Approve → `addToolResult({ decision: 'approved' })` fires → part flips to `state:'output-available', output:{ decision:'approved' }`.
4. Card re-renders the **"✓ Approved"** receipt (still live, but `state` has progressed).
5. Agent reads the result via the server and continues.

**Historical moment (same conversation, reloaded later):**

1. History fetch returns the stored parts: `{ state:'output-available', input:{…}, output:{ decision:'approved' } }`.
2. Renderer looks up the same component, passes `mode:'historical'`.
3. Card hits the historical branch → renders **"✓ Approved · 0.5 ETH"** frozen.
4. No buttons. No `addToolResult` wired. No re-firing of the tool. No effects.

**Mental model:** live = the component is *acting out* the tool execution. Historical = the component is *quoting* what happened, in past tense. The registry only answers "does this tool have a UI?"; the component owns everything about how both tenses look.

### 4.2.3 Live-only behaviours killed in historical mode

- `PreviewCard`'s `usePreviewCountdown` — don't mount it in the historical branch. Frozen card shows "✓ Confirmed" or "⌛ Expired" directly from `output`.
- `PendingTxCard`'s explorer / chain polling — not rendered. Frozen card shows final block + status from `output`.
- Approval / retry buttons — not rendered.
- Progress animations, pulsing dots, streaming placeholders — not rendered.
- Any `useEffect` with side effects — either absent from the historical branch or guarded by `if (mode === 'live')` at the hook level.

### 4.3 Parts-based renderer

Replace the contents of `MessageContent.tsx` with a parts iterator:

```tsx
for (const part of message.parts) {
  if (part.type === 'text') {
    render <MarkdownMessage text={part.text} />;
    continue;
  }
  if (part.type === 'tool') {
    const Component = toolComponents[part.toolName];
    if (!Component) continue;          // silent by default
    render <Component {...part} mode={mode} addToolResult={mode === 'live' ? liveCb : undefined} />;
  }
}
```

This preserves part ordering (text and cards interleave as the model produced them) and unifies live + historical rendering behind the same code path.

### 4.4 Live vs historical mode resolution

```ts
function resolveMode(message: AgentMessage, streamingMessageId: string | null): 'live' | 'historical' {
  if (message.id === streamingMessageId) return 'live';
  // Resumed/persisted message → always historical, even if it's the tail of the log.
  return 'historical';
}
```

The single source of truth for "live" is: **"is this the message currently being streamed in the active session?"** Nothing else is live. A session loaded from history has no live messages until the user sends a new one.

## 5. Live-turn execution flow (unchanged)

Today's flow stays as-is — we just teach it to emit/append `AgentMessagePart`s rather than free text:

1. **User** sends message → push `{role:'user', parts:[{type:'text'}]}`.
2. **Agent** streams text deltas → append to current assistant message's trailing `text` part (`state` n/a for text parts).
3. **Agent** emits `tool_pending` → append `{type:'tool', state:'input-available', input, toolCallId, toolName}` to the current assistant message.
4. **Mobile executor** runs the tool. `PendingTxCard`/`PreviewCard`/etc. subscribe to live state keyed by `toolCallId` and render progressive UI.
5. **Mobile executor** resolves → update the part to `{state:'output-available', output}` and POST the same `output` to `/chat/respond` for the agent.
6. Loop back to step 2 until the agent emits `done`.

**What's new:** every UI state change that the user perceives must be mirrored into the `parts` array, not held in ephemeral runtime state. The `pendingTxStore` and component-local `useState` become *caches* of the authoritative `parts` data, not primary storage.

## 6. Historical-turn flow (new)

1. User taps a conversation in `ConversationHistory`.
2. `resumeConversation(id)` fetches the conversation (already implemented) and reconstructs `AgentMessage[]` from the server's `ModelMessage[]` (see §7.2 for the shape translation).
3. Rendering uses the same `MessageContent` pipeline with `mode: 'historical'` for all messages.
4. Every tool card renders its terminal form. Orphaned tool calls (no matching `tool-result`) render as **"⚠︎ Interrupted"** (see §8).
5. No effects fire. No tools re-run. No modals open.
6. User sends a new message → a fresh **live** assistant message is created at the bottom. Everything above stays frozen.

## 7. Required changes

### 7.1 Mobile — client

| # | Change | Files | Effort |
|---|---|---|---|
| M1 | Add `AgentMessage` / `AgentMessagePart` types | new `services/agent-messages/types.ts` | S |
| M2 | Translator: `ModelMessage[]` (server shape) ↔ `AgentMessage[]` (client shape) — pairs `tool-call` parts from assistant messages with their matching `tool-result` from `tool` messages by `toolCallId`; unwraps `output:{type:'json', value}` | new `services/agent-messages/translate.ts` (+ unit tests) | M |
| M3 | Build `StructuredUI/` registry — plain `Record<toolName, Component>`; no display enum, no fallback in production (absence = silent) | new files | S |
| M4 | Rewrite `MessageContent.tsx` as a parts iterator; take `mode` prop | `MessageContent.tsx` | S |
| M5 | Migrate `PendingTxCard` into the registry with live/historical branches (historical = "✓ Confirmed in block N · tap for explorer" frozen form with no polling) | `PendingTxCard/PendingTxCard.tsx`, `usePendingTxCards` | M |
| M6 | Migrate `PreviewCard` into the registry with live/historical branches (historical = "✓ Confirmed 0.5 ETH to 0xabc…" with no countdown) | `PreviewCard/PreviewCard.tsx`, `usePreviewCountdown` | M |
| M7 | Inline-ify approval: replace `SpendingApprovalModal` with `SpendingApprovalCard` (human-in-the-loop tool, resolves via `addToolResult`). Keep a thin modal wrapper only for flows that *must* be modal (seed reveal, signing) and always flank with system bubbles | `SpendingApprovalModal`, `AgentMode.tsx`, `agentSession.ts` | L |
| M8 | Make `fromStoredMessage` parts-aware — stop collapsing `tool` role and plain-text mapping; wire the translator | `AgentMode.tsx:104-111`, `useConversations.ts:15-20` | M |
| M9 | Replace `extractToolCalls.ts` + `extractTextContent.ts` call sites; keep the helpers only if still referenced elsewhere | `MessageContent.tsx`, others | S |
| M10 | Wire `streamingMessageId` so `resolveMode` can distinguish live vs historical | `AgentMode.tsx`, `agentSession.ts` | S |
| M11 | Add one new first-class tool (`SwapQuoteCard`) end-to-end to validate the pattern | server tool + mobile card | M |

### 7.2 Server — minor contract notes

The server persists `ModelMessage.content[]`. The client must translate:

```
assistant.content: [
  { type: 'text', text },
  { type: 'tool-call', toolCallId, toolName, input },
  ...
]
tool.content: [
  { type: 'tool-result', toolCallId, toolName, output: { type: 'json', value } }
]
```
→
```
AgentMessage(assistant).parts: [
  { type: 'text', text },
  { type: 'tool', toolCallId, toolName, input, output?: value, state: <derived>, error? },
  ...
]
```

`state` is derived: matched output → `'output-available'`; matched output with explicit error flag → `'output-error'`; unmatched tool-call → `'input-available'` on the server but rendered as **interrupted** on the client (§8). The client never sees `input-streaming` in historical data.

Suggested (not blocking) server improvements:

- **S1 (optional):** Persist partial turns on SSE disconnect, not just end-of-turn. Today `src/chat.service.ts:280-293` only writes on the clean-idle branch. Non-blocking for this spec, but reduces orphan churn.
- **S2 (optional):** When the server re-emits `tool_pending` on reconnect (`buildReconnectResponse`), add a machine-readable `interrupted_at` hint so the client can mark truly dead parts as `'output-error'` server-side rather than inferring on the client.

## 8. Edge cases

| Case | Rule |
|---|---|
| Tool call has no matching result in history | Render as **"⚠︎ Interrupted"** terminal card. No retry button. User asks again in a new message. |
| Output contains sensitive data | `sanitizeMessages` already strips it server-side — cards must render gracefully when fields show `[REDACTED]`. |
| Card component is tied to a removed tool name | Renderer returns `null` (silent). Agent still has the result in its context; user sees the agent's subsequent text only. No crash. |
| Tool is agent-only by design (e.g. intent classification, rate-limit check) | Don't register a component. Silent is the default — no opt-out needed. |
| User reopens an active session mid-turn (reconnect) | Streaming message re-attaches via `buildReconnectResponse` → stays `mode:'live'`. All prior messages are `mode:'historical'`. |
| Two tabs / two devices open the same conversation | Each device renders its own `streamingMessageId`. A remote turn completing lands via server persistence on next load; it becomes historical on this device. |
| User taps a card's explorer link in historical mode | Allowed — it's a read-only outbound action, not an agent interaction. |
| Clock skew breaks a historical countdown | Countdown components must no-op when `mode === 'historical'` regardless of deadline. |

## 9. Explicit non-goals

- **RSC / `streamUI` / `createStreamableUI`.** Web-only, not supported in Hermes. We stream structured data and map it to components client-side.
- **Returning JSX from server tools.** All tool outputs stay serializable JSON.
- **Redesigning live card visuals.** This spec is about structure, not design. Live cards render exactly as they do today.
- **Unifying modals away entirely.** Seed reveal, signing, and other security gates stay modal. Only `SpendingApprovalModal` is inlined, because its decision belongs in the replay log.
- **Adding server-side `parts` table.** `contentJson` is adequate; derivation is cheap.

## 10. Migration order

Each step is shippable on its own. Old code paths stay until they're demonstrably unused.

1. **M1 + M2 + M3 + M4** — types, translator, registry scaffolding, parts iterator. `GenericToolCard` covers every tool name. Visual parity with today (no regressions, no new cards).
2. **M5** — migrate `PendingTxCard` behind the registry; add historical branch. First card to prove replay fidelity.
3. **M6** — migrate `PreviewCard` behind the registry; add historical branch.
4. **M10 + M8 + M9** — wire live/historical mode resolution and make history load parts-aware. *This is the flip point* — after this step, reopening an old conversation renders the real cards, not text.
5. **M7** — inline-ify approval (`SpendingApprovalModal` → `SpendingApprovalCard`). Requires server-side tool to be defined without `execute` for human-in-the-loop resolution.
6. **M11** — add `SwapQuoteCard` as a brand-new tool end-to-end. Validates the pattern for net-new work.
7. **S1 / S2** (server, optional) — reduce orphan churn. Do only if observed in practice.

## 11. Success criteria

- Reopening any conversation ≥ 24h old renders **the same cards** (tx status, preview, quotes) that the user saw live, in the same order, with no interactive affordances.
- Zero `useEffect` in card components fires when `mode === 'historical'`.
- Adding a new **visible** tool = (a) define server tool, (b) write one component with live + historical branches, (c) add one line to `toolComponents`. No touches to `MessageContent` or `AgentMode`.
- Adding a new **agent-only** tool = (a) define server tool. That's it. Registry stays untouched; the user never sees it; the agent still reasons over the result.
- Live UX (spinners, countdowns, approval flow) is identical to pre-refactor.
- Modal usage on the agent screen is limited to security-critical gates; approval flows are inline.

## 12. Open questions

- Should `system`-role messages be a first-class persisted role on the server, or purely client-synthesized around modal invocations? (Leaning: client-only for now; promote to server if we find we need cross-device parity for system frames.)
- Should the translator live in `agent-api`'s response (pre-translate server-side) or on the client? (Leaning: client — keeps the server API shape stable for non-mobile consumers.)
- Orphan detection heuristic — is "no matching `tool-result` after N minutes" good enough, or do we want explicit server-side marking? Likely revisit with S2 once real data exists.

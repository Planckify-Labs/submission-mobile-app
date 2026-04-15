# Task 09 — Inline-ify approval: `SpendingApprovalModal` → `SpendingApprovalCard`

**Status:** Not taken
**Owner:** Mobile (mobile-app) + minor server coordination
**Spec reference:** `generative-ui-spec.md` §2 principle 6, §4.2.2, §7.1 M7

## Why this matters

Approval decisions belong in the replay log. Today
`SpendingApprovalModal` resolves its decision in ephemeral React state
and the outcome disappears on reload — a historical conversation can't
say "you approved 0.5 ETH here." §2 principle 6 is explicit:

> Interaction never dead-ends in a modal. Decisions made in live mode
> must be persisted back into the tool's `output` so they survive
> reload as part of the historical receipt.

This is also the task that validates the **human-in-the-loop** tool
pattern — the server defines the tool without an `execute` handler
and waits for the mobile executor to resolve via `addToolResult`.

## Scope

1. **Server:** make `approveSpending` (or equivalent tool name) a
   human-in-the-loop tool — no `execute`, the server's agent loop
   (`awaitMobileResult`) blocks until mobile posts the result.
2. **Mobile:** create
   `components/home/TakumiAgent/StructuredUI/cards/SpendingApprovalCard.tsx`
   per the walkthrough in §4.2.2:
   - `mode === 'historical'` → frozen receipt: `"✓ Approved · {amount}
     {token}"` or `"✗ Rejected"`.
   - `mode === 'live'` + `state === 'input-available'` → interactive
     card with **Approve** / **Reject** buttons that call
     `addToolResult({ decision: 'approved' | 'rejected' })`.
   - `mode === 'live'` + `state === 'output-available'` → same frozen
     receipt as historical.
3. **Register** the card in `StructuredUI/registry.ts`.
4. **Remove** `SpendingApprovalModal` invocation from `AgentMode.tsx` /
   `agentSession.ts`. Delete the approval-state ephemeral store if it
   has no other consumers.
5. **Keep a thin modal wrapper** only for security-critical flows that
   *must* be modal (seed reveal, signing). §7.1 M7. Those flows still
   emit a `system`-role bubble before and after the modal so the
   outcome survives reload (§4.1).

## Rules (non-negotiable)

- **No ephemeral state for the decision.** The decision lives in
  `output` on the tool part, persisted server-side. React state is
  at most a UI disable flag while the request round-trips.
- **Card renders from `parts` only.** The historical branch must not
  look up anything from a store or network.
- **Security-critical gates stay modal.** Seed reveal and signing
  remain modal (§9 non-goals). Do not inline those.
- **System bubble pair around retained modals.** When a modal is still
  the right UX, flank its invocation with system-role messages so the
  replay log says "Approval requested" → "Approved" (§2 principle 6,
  §4.1).

## Acceptance

- [ ] Approve / Reject flow works identically to today from the user's perspective in live mode.
- [ ] After approving in a live turn and reloading the conversation, the historical card shows `"✓ Approved · …"` with no buttons.
- [ ] `SpendingApprovalModal` is no longer mounted from `AgentMode.tsx` for spending approval flows.
- [ ] Seed reveal / signing still use modals (regression check).
- [ ] Server-side `approveSpending` tool is defined without `execute`; `awaitMobileResult` blocks until mobile resolves.

## Out of scope

- New tools (task 10).
- Server persistence improvements (tasks 11, 12).

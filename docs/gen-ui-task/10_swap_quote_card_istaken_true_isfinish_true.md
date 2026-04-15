# Task 10 — End-to-end new tool: `SwapQuoteCard`

**Status:** Not taken
**Owner:** Mobile (mobile-app) + Server (agent-api)
**Spec reference:** `generative-ui-spec.md` §7.1 M11, §11 success criteria

## Why this matters

Everything before this task was refactoring the existing surface. This
task validates the *additive* half of the spec — adding a brand-new
first-class tool end-to-end:

> Adding a new visible tool = (a) define server tool, (b) write one
> component with live + historical branches, (c) add one line to
> `toolComponents`. No touches to `MessageContent` or `AgentMode`.

If this task requires changes to `MessageContent` or `AgentMode` to
ship, the refactor is not done and the earlier tasks have a gap.

## Scope

1. **Server (`takumi-agent-api`):** add a `swap_quote` tool (name is
   illustrative — pick something the agent can actually call) that
   returns a quote payload: `{ fromToken, toToken, fromAmount,
   toAmount, route, priceImpactBps, expiresAt, … }`. Serializable
   JSON only (§9 non-goals).
2. **Mobile:** create
   `components/home/TakumiAgent/StructuredUI/cards/SwapQuoteCard.tsx`
   with live + historical branches. Live can show a countdown to
   `expiresAt`, route breakdown, an "Accept" button that leads into
   a preview/pending-tx flow. Historical shows a frozen quote
   receipt with no countdown and no "Accept" button.
3. **Register** it in `StructuredUI/registry.ts` — exactly **one
   line** of diff here.
4. **Verify** by screenshotting the chat after the agent calls the
   tool; reload the app and screenshot the historical render.

## Rules (non-negotiable)

- **No touches to `MessageContent.tsx` or `AgentMode.tsx`.** If you
  need to, stop and fix the refactor instead.
- **Output is JSON.** No JSX from the server, no RSC (§9 non-goals).
- **Live-only behaviors guarded.** Countdown to `expiresAt` must
  no-op in historical mode (§4.2.3, §8 clock-skew rule).
- **Agent-only variant is free.** If there's a sibling tool that
  shouldn't render UI (e.g. `rank_swap_routes` used only as an
  internal step), simply don't register a component — the agent
  still reasons over its output (§4.2).

## Acceptance

- [ ] `swap_quote` tool is callable by the agent end-to-end from the mobile app.
- [ ] Live render matches the design; accepting leads to a proper preview/pending-tx flow.
- [ ] Historical render is a frozen receipt with no timers and no interactive affordances.
- [ ] Diff summary of the PR shows changes in: server tool file, new card file, one new line in `StructuredUI/registry.ts`. *Nothing else in the mobile app.*
- [ ] At least one sibling agent-only tool exists (or is documented as a follow-up) to demonstrate the silent case.

## Out of scope

- Production swap execution (may be stubbed against a single aggregator for now).
- Server-side persistence improvements (tasks 11, 12).

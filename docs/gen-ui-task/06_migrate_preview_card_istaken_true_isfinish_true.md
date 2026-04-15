# Task 06 — Migrate `PreviewCard` with live/historical branches

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.2.3, §7.1 M6

## Why this matters

`PreviewCard` + `usePreviewCountdown` is the clearest example of a
live-only behavior that **must not** run in historical mode — clock skew
alone would render a replayed countdown nonsense (§8 "clock skew breaks
a historical countdown"). Migrating it exercises the rule from §4.2.3
that countdown components no-op when `mode === 'historical'` regardless
of deadline.

## Scope

Move the component into
`components/home/TakumiAgent/StructuredUI/cards/PreviewCard.tsx` and
branch on `mode`:

- **Live branch** — unchanged behavior: renders the preview, uses
  `usePreviewCountdown` to 3s-auto-proceed or let the user cancel.
- **Historical branch** — derive from `output` only:
  - `output.status === 'confirmed'` → *"✓ Confirmed 0.5 ETH to 0xabc…"*
  - `output.status === 'cancelled'` → *"✗ Cancelled"*
  - `output.status === 'expired'` → *"⌛ Expired"*
  - no countdown mounted at all.

Register for the relevant preview tool names in
`StructuredUI/registry.ts`.

## Rules (non-negotiable)

- **`usePreviewCountdown` is never called in the historical branch.**
  Not disabled internally — not called at all. Hook-at-the-top-level is
  fine because the live/historical branching happens at the component
  return level; the hook can be gated `if (mode === 'live')` only via
  an early return that renders the historical receipt *before* any
  hooks run. If that's awkward, split the live and historical renderers
  into two small components and have the outer one pick.
- **Historical receipt is deterministic.** Given the same `output`, the
  historical card renders byte-identical text every time.
- **Live UX unchanged.** 3s auto-proceed, cancel affordance, visuals —
  identical to pre-refactor.

## Acceptance

- [ ] Registered for every tool name that currently produces a preview card.
- [ ] Live mode: existing flow renders exactly as before.
- [ ] Historical mode: no countdown timer, no `setInterval`, no `Date.now()`.
- [ ] Unit/snapshot test: given a fixture `output`, historical branch renders the expected frozen text.
- [ ] Visual parity screenshot on iOS + Android attached to the PR.

## Out of scope

- `PendingTxCard` (task 05).
- Parts-aware history loading (task 08).

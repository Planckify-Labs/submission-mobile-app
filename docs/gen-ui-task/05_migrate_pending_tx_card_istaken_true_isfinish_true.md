# Task 05 — Migrate `PendingTxCard` with live/historical branches

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `generative-ui-spec.md` §4.2.2, §4.2.3, §7.1 M5

## Why this matters

`PendingTxCard` is the single most visible live artifact today (polls the
chain, opens explorer, mutates via `pendingTxStore`). It's also the first
real proof that the registry pattern can host today's behavior without
regressions. Migrating it is the "prove replay fidelity" milestone in
§10 step 2 — after this ships, at least one card renders correctly from
stored `parts` after a reload.

## Scope

Move (don't duplicate) the component into
`components/home/TakumiAgent/StructuredUI/cards/PendingTxCard.tsx` and
branch on `mode`:

- **Live branch** — same behavior as today: subscribes to `pendingTxStore`
  / chain polling keyed by `toolCallId`, shows progress states, taps to
  explorer.
- **Historical branch** — renders a frozen receipt derived **only** from
  `input` + `output`: e.g. *"✓ Confirmed in block N · tap for explorer"*
  (explorer link is a read-only outbound, allowed per §8).

Register it in `StructuredUI/registry.ts`:

```ts
import { PendingTxCard } from './cards/PendingTxCard';
toolComponents['send_native_token'] = PendingTxCard;
toolComponents['transfer_erc20']    = PendingTxCard;
toolComponents['write_contract']    = PendingTxCard;
// …any other tool names that currently produce a pending-tx card
```

Update `usePendingTxCards` so it remains the *cache* keyed by
`toolCallId` — the primary storage for the decision becomes the
`output` of the tool part (§5 last paragraph).

## Rules (non-negotiable)

- **Branch on `mode` FIRST**, then on `state`. §4.2.1.
- **Zero effects fire when `mode === 'historical'`.** No polling, no
  subscriptions, no `Date.now()` reads. §4.2.3.
- **Output must be self-sufficient.** If the historical branch needs
  info that isn't in `output`, enrich the tool's `output` schema — do
  not reach into a store. §4.2.1 "if a component can't render
  historically without network/store access, its output shape is wrong
  and should be enriched."
- **Live UX unchanged.** Visuals, spinners, explorer link, retry — all
  identical to pre-refactor. The test is that the live mode is
  **indistinguishable** from main.

## Acceptance

- [ ] Registered for every tool name that produces a pending-tx card.
- [ ] Live mode: existing integration flow (send native / erc20 / write contract) still shows the exact same UI.
- [ ] Historical mode: reopening a past transaction renders the frozen receipt with no effects firing (add a dev `useEffect(() => { if (__DEV__ && mode === 'historical') console.warn(...); })` guard during development to prove this; remove before merge).
- [ ] `usePendingTxCards` reads `pendingTxStore` only when `mode === 'live'`.
- [ ] Old call sites in `MessageContent` / `AgentMode` that used the pre-registry card are removed.
- [ ] Visual parity screenshot on iOS + Android attached to the PR.

## Out of scope

- `PreviewCard` (task 06).
- Parts-aware history loading (task 08) — this task can land behind the live path only; the flip happens in step 4 of §10.

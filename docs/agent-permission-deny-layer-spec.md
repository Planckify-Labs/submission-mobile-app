# Agent Permission Layer — Hard-Deny & Single Gate — Engineering Spec

> **Status:** Draft v0.3 · Owner: Agent · Last updated: 2026-06-25
> **Scope:** Make every agent **write** tool pass through one authorization
> decision that fails *closed*, and bind the "run-down" auto-execute
> countdown to the *authorized* state only. In-app (on-device) enforcement
> now; on-chain enforcement is a deferred second tier (see §9).
> **Related:** `docs/multi-agent-architecture-spec.md` (§5–6, AGENT_PROTOCOL),
> `docs/eip7710-1shot-relayer-spec.md`, `docs/erc7710-delegation-caveats-spec.md`.

---

## 1. Problem statement

The agent (DeFi, Wallet, …) must never move value without the user's
permission. The requirement, in the user's words:

> All agent tools share a **single source of truth** for permission. Every
> registered tool must pass through that layer. If there is no permission,
> the call is **hard-rejected**. A "run-down" countdown that auto-executes
> on timeout is only correct **when the agent already has permission** — it
> is a veto/grace window, not a substitute for permission.

The current implementation is ~80% there but has a **fail-open** defect and
a **second, decision-blind approval surface**. This spec closes both.

---

## 2. Current architecture (what already exists)

The brain runs in the sibling `../agent-api` service. Every value-moving
tool is declared `executor: "mobile"`, so **the agent cannot execute a write
itself** — it can only emit an SSE `tool_pending` event and wait for the
device to execute and reply via `POST /chat/respond`. This is the core
security boundary and it is sound: the LLM cannot forge an execution.

On the device:

```
SSE tool_pending
   │
   ▼
handleToolPending           services/agentSession/dispatcher.ts   ← the gate
   │  resolveUXTreatment(grant ⊕ ApprovalPolicy ⊕ thresholds)     services/resolveUxTreatment.ts
   ▼
 silent | preview | confirm | blocked
   │  (only an allowed path runs:)
   ▼
runNonInteractive → executeToolWithRetry → EXECUTORS[name]        services/agent-executors/
   │
   ▼  POST /chat/respond → tool_result | tool_rejected{reason}
```

- Grants: `services/permissionGrantStore.ts` — wallet-scoped, SecureStore
  (already encrypted on device), lifetimes `always_ask | once | session |
  timed | permanent`, plus ERC-7710 `delegation` grants for the on-chain
  tier. `resolveGrant()` priority: tool > capability > global.
- Policy: `ApprovalPolicy` (`HOT_WALLET_POLICY`, etc.) drives treatment when
  no grant applies. Active session uses `HOT_WALLET_POLICY`.
- Thresholds: `services/transferThresholdStore.ts` — per-token / per-defi
  auto-approve below a USD amount. Shipped defaults are all `0` (= always ask).

**Verified single call site:** the only place the app invokes an executor is
`dispatcher.ts:247` (`executeToolWithRetry`), reached only via
`runNonInteractive`, called only by `handleToolPending`. No tool bypasses the
dispatcher today.

---

## 3. Defects found

### D1 — Fail-open timeout (the run-down approves on inaction)
`PreviewCard` runs a countdown (`usePreviewCountdown.ts`) that fires
**`onConfirm()`** on elapse (`usePreviewCountdown.ts:143,169`). The dispatcher
wires `preview`'s `onConfirm` to `runNonInteractive` (execute). So **doing
nothing = approval.** A permission gate must fail *closed*.

This is acceptable **only** when the call is already authorized (a standing
grant / configured threshold). It must never be reachable for an
unauthorized call.

### D2 — Second, decision-blind approval surface
The dispatcher calls `upsertToolPart({ state: "input-available" })`
(`dispatcher.ts:70`) for **every** tool, which renders the inline StructuredUI
card. For writes those cards render *their own* `<PreviewCard>` with a 3s
auto-confirm countdown:

- `PendingTxCard.tsx:248-262` → `send_native_token`, `transfer_erc20`,
  `write_contract`, **`defi_deposit`, `defi_withdraw`, `defi_claim`**
  (`registry.ts:40-42,67-69`).
- `SolanaPendingTxCard.tsx`, `SuiPendingTxCard.tsx` (incl. **`defi_intent_execute`**).

These countdowns are **not bound to the permission decision**. They resolve
via `addToolResult → handleAddToolResult` (`AgentMode.tsx:1231`), which only
acts if a decision was registered in `toolDecisionsRef` — and only
`showPreviewCard` registers one (`AgentMode.tsx:841`; `showApprovalSheet`
does not, `:851`). Net effect:
- On a `preview` tool: two countdowns race, both can auto-execute.
- On a `confirm` tool: the inline countdown is a **silent no-op** — the user
  still *sees a run-down* implying auto-approval while the real gate is the
  timer-less approval sheet. This is the confusing "run-down I didn't
  authorize" the user reported for defi.

### D3 — `SpendingApprovalCard` reject is read as approve
`SpendingApprovalCard.tsx:116,121` emits `{ decision: "approved" | "rejected" }`,
but `handleAddToolResult` (`AgentMode.tsx:1235-1242`) only recognizes the
`user_decision` key. Anything that is not literally `user_decision:"rejected"`
falls through to `onConfirm()`. A **reject is executed as an approve.** Fail-open.

### D4 — DeFi thresholds are dead config
`resolveUXTreatment` supports a `defiInfo` path (`resolveDefiThreshold`), but
the dispatcher never passes `defiInfo` (`dispatcher.ts:93-100`). The defi
auto-approve settings in `transferThresholdStore` therefore have no effect.

---

## 4. Model: one rule, two axes

### 4.0 The permission model — `Scope → {Auto | Ask | Never}`

Every permission is **one rule**, modeled exactly like browser site
permissions (Allow / Ask / Block):

> **`Scope → {Auto | Ask | Never}`**, plus a **Default** rule.

- **Scope** (most-specific wins): a specific **tool** (`defi_deposit`) ›
  a **capability** (`read`, `write`) › **global** (the Default).
- **Rule**:
  - **Auto** — run without asking (writes still get the 6 s run-down veto, §D-1).
  - **Ask** — proposal card → approval sheet (§4.1).
  - **Never** — hard deny (`permission_denied`).
- **Resolution:** most-specific scope wins, **except `Never` always wins**
  (deny-overrides-allow, §6.2).
- **Fund Threshold** (§D-3) is a modifier on a value scope: *"Auto, but only
  below $X."* Below → Auto; at/over → Ask.

Everything the screen exposes collapses into this one model — no separate
"block" feature, no overlapping toggles:

| Surface | Is just… |
|---------|----------|
| Mode selector (Always ask / Full auto / Agent decides) | the **Default** rule |
| "Auto-approve read actions" | **Read → Auto** |
| "Block all writes" | **Write → Never** (a rule value, not a button) |
| Per-tool "always allow" / "never allow" | **tool → Auto** / **tool → Never** |
| "Reset to defaults" (was "Revoke all") | clear all overrides → Default only |

### Axis 1 — Authorization: rule → decision

The rule resolves to one **decision** computed by `authorizeToolCall()` — the
single source of truth. The user-facing rule maps 1:1:

| Rule (user) | Decision (internal) | Grant lifetime |
|-------------|---------------------|----------------|
| Auto        | `authorized`        | `permanent`/`session`/`timed` (or a covering Fund Threshold) |
| Ask         | `ask`               | `always_ask` (or the safe default) |
| Never       | `deny`              | `always_deny` |

`watch_only` wallets and headless-with-no-Auto also resolve to `deny`.
Default for an unmatched write is **Ask** (safe), never Auto. **Deny overrides
allow:** any `Never` (`always_deny`) wins over any Auto grant at any scope
(§6.2) — `Write → Never` blocks every write tool and a per-tool Auto cannot
re-enable it.

### Axis 2 — Presentation (chosen only *after* authorization)

| decision     | presentation                                                       |
|--------------|-------------------------------------------------------------------|
| `authorized` + write | **run-down card** — always (§D-1). 6 s veto window: Approve-now / Reject; at 0 → execute. |
| `authorized` + read  | `silent` (status chip).                                    |
| `ask`        | **two-step, no timer** — proposal card → approval sheet (§4.1).    |
| `deny`       | no card; reject with `permission_denied`.                          |

> **§D-1 (resolved):** Writes are **never** `silent`. *Every* authorized write
> shows the run-down so the user always has a veto window — including
> "Full auto" mode, which now means "auto-approve after the run-down," not
> "execute silently." `silent` applies to reads only. Run-down duration is
> **6 000 ms** (§D-2).

### 4.1 The `ask` flow (no permission → explicit, two-step)

When a write is **not** authorized, the user must make a deliberate choice.
There is **no countdown** anywhere on this path — nothing executes on inaction.

```
ask decision
   │
   ▼
[Proposal card]  inline in the thread, shows human_summary + amount
   ├── Reject  ──► reject the proposed tool   → tool_rejected{user_declined}
   └── Approve ──► open the Approval Sheet (with its options)
                        ├── Confirm (+ optional grant scope/lifetime) ──► execute
                        └── Cancel ───────────────────────────────────► tool_rejected{user_declined}
```

- **Step 1 — Proposal card.** Two buttons only: **Reject** and **Approve**.
  Reject rejects the proposed tool outright. Approve does *not* execute — it
  advances to step 2. This keeps the agent's intent visible and the user's
  action explicit ("here's what I want to do" → "no" / "show me the details").
- **Step 2 — Approval sheet.** The existing `ApprovalSheet` with its options
  (final confirm, and the grant-scope/lifetime choices — e.g. *Once*,
  *This session*, *Always for this tool* → installs a grant so future calls
  resolve to `authorized`). Confirm executes; cancel/dismiss rejects.

The two steps are stages of **one** flow bound to **one** decision/resolution
(see INV-2) — not two competing surfaces. Reaching step 2 never auto-resolves;
only an explicit Confirm in the sheet executes.

### 4.2 Decision visibility to the agent

Whatever the user decides, the agent must see it — so it can react ("Done,
sent $20" / "Okay, cancelled" / "I need permission for that — enable it in
settings?") instead of guessing or retrying. This is already structural: the
agent loop blocks on `POST /chat/respond` (AGENT_PROTOCOL §9), and the
dispatcher posts exactly one terminal message per call.

| User / system outcome | Wire message to agent | Agent should…
|-----------------------|-----------------------|---------------
| Approve → executed ok | `tool_result{status:"success", tx_hash?, data}` | confirm the action |
| Approve → executed, failed | `tool_result{status:"failed", error}` | explain it failed (friendly), offer retry |
| User taps **Reject** (proposal card) or cancels the sheet | `tool_rejected{reason:"user_declined"}` | acknowledge, do not retry |
| No permission / `always_deny` / headless | `tool_rejected{reason:"permission_denied"}` | explain it's not permitted; suggest granting |

Notes:
- **Only the terminal resolution is reported.** Intermediate UI steps —
  e.g. tapping **Approve** on the proposal card to open the sheet — are *not*
  posted to the agent; they carry no decision yet. The agent sees a result
  only when the tool actually runs or is finally rejected. (`/chat/progress`
  delay hints are UX sugar, not decisions — `networkHelpers.ts:156`.)
- `user_declined` vs `permission_denied` are semantically distinct on purpose:
  the first is "the user said no to this specific action," the second is "the
  user has not authorized this capability at all." The agent-api system
  prompts must handle them differently (see §6.6).
- The wire `reason` is a short fixed token, never raw error text — friendly
  user copy stays in the UI, raw detail in `__DEV__` logs only (user-facing
  error rule).

---

## 5. The invariant

> **INV-1:** The run-down auto-execute countdown is wired **iff**
> `decision === "authorized"`. An `ask`/`deny`/unauthorized call can never be
> connected to an auto-confirm.

> **INV-2:** Each tool call has exactly one approval *flow* bound to one
> decision and resolved exactly once. The `authorized` run-down and the `ask`
> proposal-card→sheet are single flows — not the two competing, decision-blind
> surfaces that exist today (§3 D2). A flow may have sequential steps (proposal
> card → approval sheet); it must never have parallel auto-resolvers.

> **INV-3:** `executeToolWithRetry` cannot be called without an
> authorization token minted by `authorizeToolCall()` (structural single
> source of truth — §6.4).

> **INV-4 (decision visibility):** Every tool call resolves to exactly one
> terminal message posted to `/chat/respond`, and the agent loop is blocked
> until it arrives — the agent never proceeds without, or hangs on, a user
> decision. The terminal message tells the agent *which* decision was made
> (approve→`tool_result`, user reject→`tool_rejected{user_declined}`, policy
> deny→`tool_rejected{permission_denied}`). See §4.2.

---

## 6. Implementation

### 6.1 `authorizeToolCall()` — new
`services/agentSession/authorizeToolCall.ts`. Pure, unit-testable.

```ts
export type PermissionDecision = "authorized" | "ask" | "deny";

export type PermissionDenyReason =
  | "policy_denied"          // always_deny grant, or policy = blocked
  | "watch_only"             // wallet cannot sign
  | "approval_unavailable";  // headless: ask required, no human present

export interface ToolAuthorization {
  decision: PermissionDecision;
  /** Presentation hint for the dispatcher/UI. */
  treatment: "rundown" | "silent" | "ask";
  reason?: PermissionDenyReason;
  /** Opaque token required by executeToolWithRetry. Minted only here. */
  token: AuthorizationToken;
}

export function authorizeToolCall(args: {
  capability: ToolCapability;
  toolName: string;
  wallet: ConnectedWallet;
  sessionId: string;
  interactive: boolean;
  amountUsd?: number;
  transferInfo?: TransferInfo;
  defiInfo?: DefiInfo;          // FIX D4: dispatcher now supplies this
}): ToolAuthorization;
```

Mapping (reuse existing `resolveGrant` + `resolveFromPolicy`):
- `always_deny` grant, or policy treatment `blocked` (watch-only) → `deny`.
- grant `permanent | session | timed`, or a configured threshold that covers
  `amountUsd` → `authorized` (`rundown` for writes, `silent` for reads).
- grant `always_ask`, or default policy `confirm` with no covering threshold
  → `ask`.
- `interactive === false` and decision would be `ask` → downgrade to `deny`
  (`approval_unavailable`). Fail closed when no human can approve.

### 6.2 `always_deny` grant lifetime — `permissionGrantStore.ts`
Add `{ type: "always_deny" }` to `GrantLifetime`. **Deny overrides allow:**
`resolveGrant` first scans *all* scopes (tool, capability, global) for any
active `always_deny`; if found it returns deny immediately, regardless of scope
specificity. Only then does it apply the normal tool > capability > global
priority for allow/ask grants. (This differs from `always_ask`, which keeps the
priority ordering — deny is the safety-critical override.) Purely additive —
existing grant blobs still deserialize.

`always_deny` is just the **`Never`** rule (§4.0). Two scopes matter:
- **tool → Never** — `{ scope:{tool}, lifetime:{always_deny} }` (block one tool).
- **Write → Never** — `{ scope:{capability:"write"}, lifetime:{always_deny} }`.
  Because of deny-overrides-allow, this blocks *every* write tool and cannot be
  bypassed by a per-tool Auto. This **is** "block all writes" — a rule value,
  not a dedicated button (§D-4 / §6.7).

### 6.3 Dispatcher rewire — `dispatcher.ts`
- Call `authorizeToolCall()` (pass `defiInfo` — fixes D4) instead of
  `resolveUXTreatment` directly.
- Switch on `decision`:
  - `authorized` → render the run-down (writes) or run silently (reads). This
    is the **only** branch that wires an auto-execute path.
  - `ask` → render the **proposal card** (Reject / Approve, no timer). Reject
    → `safeReject(user_declined)`. Approve → open the approval sheet; its
    Confirm runs the tool (and may install a grant), its cancel →
    `safeReject(user_declined)`. Nothing auto-resolves (§4.1).
  - `deny` → `safeReject(payload, session, "permission_denied")` (map
    `watch_only`/`approval_unavailable` to the same wire reason; keep the
    specific reason in `__DEV__` logs only, per the user-facing-error rule).
- Do **not** paint an auto-confirm inline card before the decision is known
  (fixes D2): pass the decision into `upsertToolPart` so the StructuredUI card
  knows whether it is `authorized` (show run-down) or `ask` (show static
  approve/reject, no countdown).

### 6.4 Structural enforcement — `services/agent-executors/retry.ts`
`executeToolWithRetry(name, input, ctx, opts, token: AuthorizationToken)`.
`AuthorizationToken` is a branded type whose only constructor lives in
`authorizeToolCall.ts`. A code path that has not authorized the call cannot
produce a token, so it cannot execute. This upgrades "single source of truth"
from convention to a compile-time guarantee.

### 6.5 StructuredUI write cards — `PendingTxCard`, `SolanaPendingTxCard`, `SuiPendingTxCard`, `RebalancePreviewCard`, `SpendingApprovalCard`
- Render the auto-confirm `<PreviewCard>` countdown **only** when the injected
  decision is `authorized` (INV-1). For `ask`, render the **proposal card** —
  Reject / Approve buttons, **no countdown** — where Approve opens the approval
  sheet (§4.1) rather than executing. For `deny`, render the rejected state.
- Route every approve/reject through the **one** decision callback. Remove the
  parallel auto-resolve path.
- Fix D3: standardize the result envelope on `user_decision: "approved" |
  "rejected"` across all cards; `handleAddToolResult` treats **anything that
  is not explicitly `"approved"` as reject** (fail closed), the inverse of
  today.
- **Run-down duration = 6 000 ms** (§D-2): change the `autoConfirmMs` default
  (`PreviewCard.tsx`, `showPreviewCard.tsx`, `usePreviewCountdown.ts`) from
  3000 → 6000.

### 6.6 Protocol — `services/agentSession/protocol.ts`
Add `permission_denied` to the `MobileResponse.tool_rejected.reason` union and
mirror it in `../agent-api`. The agent-api system prompts must distinguish the
three terminal outcomes (§4.2): narrate success/failure for `tool_result`,
acknowledge-without-retry for `user_declined`, and explain-and-suggest-granting
for `permission_denied` — never treat any of them as a network error.

### 6.7 Settings screen wiring (`app/agent-permissions.tsx`) & shared store

The agent-permissions screen already renders the mode selector, the read
auto-approve toggle, on-chain ERC-7710 allowances, the active-grants list, and
revoke. It must be reshaped to the one rule model (§4.0): a **Default** rule, a
list of **per-scope overrides** (each `Auto | Ask | Never`), and a **Reset**.
The wiring gaps below close for the deny layer to take effect.

**P0 — the grant store is not shared with the live session (correctness bug).**
There are two `PermissionGrantStore` instances per wallet:
- settings → its own `storeCache` (`app/agent-permissions.tsx:153`,
  `getStoreFor` → `new PermissionGrantStore(address)`);
- live session → `PermissionGrantStore.conservative(address)` in
  `grantStoreRef` (`AgentMode.tsx:328`);

and `PermissionGrantStore` has **no `subscribe`/emit** (unlike
`TransferThresholdStore`). So a grant added/revoked/denied in settings only
reaches SecureStore — a *running* session keeps its stale in-memory copy until
reconstructed, and the approval-flow writer (`AgentMode.tsx:1397`) writes to
*its* instance, invisible to settings. This breaks INV-3 across surfaces: the
"single source of truth" is not actually single.

Fix — mirror the `getTransferThresholdStore` pattern exactly:
- add a shared `getPermissionGrantStore(address)` singleton + `subscribe()` to
  `permissionGrantStore.ts` (one instance per wallet, module-level cache);
- settings, the dispatcher/`authorizeToolCall`, and the approval flow all read
  **the same** instance — delete the screen's local `storeCache`;
- `AgentMode` subscribes and re-snapshots its `ConnectedWallet` on change, just
  as it already does for thresholds (`AgentMode.tsx:342`), so a settings edit
  takes effect mid-session without a remount.

This is foundational and independently shippable — it fixes today's
stale-store bug and is what every other deny-layer change reads/writes through.

**P1 — the per-scope 3-way rule (`Auto | Ask | Never`).**
- Every override scope (tool or capability) is presented as one 3-way control,
  not scattered toggles. The existing single "Auto-approve read actions" toggle
  becomes the **Read** row (Auto/Ask/Never); add a **Write** row — `Write →
  Never` *is* "block all writes" (§D-4). Per-tool rows render the same control.
- `formatLifetimeLabel` (`agentPermissionsHelpers.ts:263`) has no `always_deny`
  case — a `Never` grant renders with a broken label. Add "Never" / "Blocked".
- `buildGrantOptions` (feeds the approval sheet) currently offers Auto flavors
  only (Once / Session / Always). Add **Ask** and **Never** so the user can set
  any rule from the sheet too; `{lifetime:{always_deny}}` installs `Never`. The
  screen lists/revokes each like any grant (`listRenderableGrants` already keeps
  it — it only drops `once`).

**P2 — stale mode copy.** The subtitles describe the old behavior:
*"Agent decides — asks for writes, previews simulations"* and *"Full auto —
executes writes silently"* (`agent-permissions.tsx:99,107`). Rewrite for the
new model: `ask` → proposal card → sheet; **"Full auto" now means writes
auto-approve after a 6 s run-down veto window (§D-1), not silently.**

**P3 — "Fund Thresholds": rename + make live (§D-3).** Rename the user-facing
"transfer / defi thresholds" section to **"Fund Thresholds"** (the underlying
`transferThresholdStore` keeps its module name; only the UI label + the screen
link change). Make them **live** by having the dispatcher pass `transferInfo`
*and* `defiInfo` into `authorizeToolCall` (fixes D4). A Fund Threshold that
covers `amountUsd` then yields `authorized` → the write runs behind the 6 s
run-down. Below-threshold = standing permission; at/over threshold = `ask`.

**§D-4 — "block all writes" = `Write → Never` (no dedicated button).**
We do **not** add a "Remove all write permissions" button next to "Revoke all"
— two destructive look-alikes was the confusion. Instead:
- "Block all writes" is simply setting the **Write** capability row to
  **Never** (P1), which installs `{capability:"write", always_deny}`. By
  deny-overrides-allow it blocks every write, un-bypassable by any per-tool
  Auto. The row's own state ("Never") is the visible indicator; flipping it back
  to Ask/Auto restores writes. Existing per-tool grants stay intact underneath.
- The existing **"Revoke all permissions"** (`handleRevokeAll`) is renamed
  **"Reset to defaults"** — a *maintenance* action that clears all overrides and
  returns to the Default rule. It's clearing, not blocking; now it doesn't
  overlap with anything.
- `computeCurrentMode` reports the `Write → Never` state so the Default selector
  doesn't falsely imply writes are allowed.

This keeps three orthogonal, non-overlapping concepts: **Default** (base rule) ·
**Overrides** (per-scope Auto/Ask/Never) · **Reset** (clear overrides).

---

## 7. Files touched

| File | Change |
|------|--------|
| `services/agentSession/authorizeToolCall.ts` | **new** — single decision + token |
| `services/permissionGrantStore.ts` | `always_deny` lifetime + **deny-overrides-allow** resolveGrant (`Write→Never` blocks all writes); **`getPermissionGrantStore()` singleton + `subscribe()`** (§6.7 P0) |
| `services/agentSession/dispatcher.ts` | switch on decision; pass `transferInfo` + `defiInfo` (live Fund Thresholds, §D-3); deny path |
| `services/agent-executors/retry.ts` | require `AuthorizationToken` |
| `services/agentSession/protocol.ts` | `permission_denied` reason |
| `services/agentSession/agentSession.ts` | `interactive` flag on session |
| StructuredUI write cards (5) | run-down iff authorized; one decision path |
| `PreviewCard.tsx` · `showPreviewCard.tsx` · `usePreviewCountdown.ts` | `autoConfirmMs` default 3000 → **6000** (§D-2) |
| `components/home/TakumiAgent/AgentMode.tsx` | `handleAddToolResult` fail-closed; pass decision to cards; **use shared grant store + subscribe-resnapshot; approval-flow writes to shared store** (§6.7 P0) |
| `agentPermissionsHelpers.ts` | `Never` (`always_deny`) label; `Write→Never` state in `computeCurrentMode`; 3-way rule helpers |
| `buildGrantOptions` (approval sheet choices) | add **Ask** and **Never** alongside the Auto flavors |
| `app/agent-permissions.tsx` | **use shared store (drop local `storeCache`)**; per-scope **Auto/Ask/Never** rows (Read + Write); `Write→Never` = block writes (§D-4); rename "Revoke all" → **"Reset to defaults"**; "Fund Thresholds" rename; refresh mode copy |
| `../agent-api` | recognize `permission_denied` |

---

## 8. Test plan
Targeted runs only (laptop-freeze constraint — run individual files, capped
workers; do not run the full suite).

- `authorizeToolCall`: grant/policy/threshold/interactive matrix → decision.
- **INV-1 regression:** assert `treatment === "rundown"` ⟹
  `decision === "authorized"`; an ungranted write can never yield `rundown`.
- `always_deny`: resolveGrant short-circuit; settings round-trip.
- Dispatcher: `ask` never auto-executes; `deny` → `permission_denied`;
  headless `ask` → `deny(approval_unavailable)`.
- `ask` two-step (§4.1): proposal-card **Reject** → `user_declined`, no execute;
  proposal-card **Approve** opens the sheet but does **not** execute; only the
  sheet's **Confirm** executes; sheet cancel → `user_declined`. "Always for
  this tool" in the sheet installs a grant so the next call resolves
  `authorized`.
- D3: card reject (any non-`approved` envelope) → `onDismiss`, never execute.
- D4: defi threshold now consulted via `defiInfo`.
- Token: `executeToolWithRetry` rejects a call with no/forged token.
- Decision visibility (INV-4 / §4.2): every path posts exactly one terminal
  message — approve→`tool_result`, reject→`tool_rejected{user_declined}`,
  deny→`tool_rejected{permission_denied}`; the proposal-card Approve step posts
  nothing on its own.
- Shared store (§6.7 P0): a grant added/revoked in settings fires `subscribe`
  and a live session's `ConnectedWallet` re-snapshots — a mid-session settings
  edit changes the next tool's decision without a remount; `getPermissionGrantStore`
  returns the same instance for settings, dispatcher, and approval flow.
- Deny-overrides-allow (§6.2): a per-tool `Never` and `Write → Never` (§D-4)
  both force `deny` even when a per-tool Auto grant exists; `Write → Never`
  blocks every write tool; "Reset to defaults" clears overrides → Default rule.
- Authorized writes (§D-1): an authorized write resolves to `rundown`, never
  `silent`; reads resolve to `silent`. Run-down window is 6 000 ms (§D-2).
- Live Fund Thresholds (§D-3): an amount below a configured Fund Threshold
  resolves `authorized` (via `transferInfo`/`defiInfo`); at/over → `ask`.

---

## 9. Tier 2 — on-chain enforcement (deferred)
The same `authorized` decision is the seam for a hard, on-chain ceiling that
holds even if the device is compromised.
- **EVM:** partially modeled — `delegation` grants + `DelegationStruct` in the
  grant store; `docs/erc7710-delegation-caveats-spec.md`; 1Shot relayer
  (`docs/eip7710-1shot-relayer-spec.md`). A signed ERC-7710 delegation with
  spend/limit caveats becomes the on-chain cap behind an `authorized` write.
- **Solana / Sui:** no EVM-style account abstraction — needs research. Likely
  shapes: Solana program-derived spend limits / session keys; Sui PTB
  guardian (the intent guardian already exists at
  `services/chains/sui/intent/guardian/`). Out of scope here; design before
  building.

---

## 10. Decisions (resolved)
- **D-1.** Authorized writes **always** show a run-down — no silent writes,
  including "Full auto" (now = auto-approve after the run-down). `silent` is
  reads only.
- **D-2.** Run-down duration = **6 000 ms** (`autoConfirmMs` default).
- **D-3.** Keep thresholds, rename to **"Fund Thresholds"**, and make them
  **live** (dispatcher passes `transferInfo` + `defiInfo`; below-threshold →
  `authorized`).
- **D-4.** All permissions use one model — `Scope → {Auto|Ask|Never}` + Default
  (§4.0). "Block all writes" is **`Write → Never`**, not a dedicated button;
  per-tool `Never` also supported; enforced via deny-overrides-allow (§6.2). The
  existing "Revoke all" is renamed **"Reset to defaults"** (clear overrides). No
  twin destructive buttons.

No open questions.

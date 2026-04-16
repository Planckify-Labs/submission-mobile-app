# Task 56 — Local notifications: tx confirmed/failed, approval detected

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.10

## Why this matters

Users need to know when their transactions confirm or fail, especially if the
app is backgrounded. Local notifications provide this without any backend
infrastructure.

## Scope

Create:

- `services/notifications/channels.ts` — notification channel definitions:
  - `tx-confirmed`: "Transaction confirmed" — default ON.
  - `tx-failed`: "Transaction failed/dropped" — default ON.
  - `approval-detected`: "New unlimited approval detected" — default ON.
  - Channel configuration stored in `expo-sqlite`.
- `services/notifications/handlers.ts` — event → notification mapping:
  - Subscribe to `PendingTxTracker` status changes:
    - `confirmed` → fire "Transaction confirmed" with tx type and amount.
    - `failed` → fire "Transaction failed" with error reason.
    - `dropped` → fire "Transaction dropped — may need to resubmit".
  - Subscribe to approval watcher (from task 48):
    - New unlimited approval → fire "New unlimited approval detected for
      [token] by [spender]".
  - Use `expo-notifications` for local notification delivery.
  - Notifications are tappable → deep link to relevant screen (tx detail,
    approvals screen).
- Request notification permission via `expo-notifications` on first relevant
  event (not on app launch).
- Notification action: tapping opens the app to the relevant screen.

## Rules (non-negotiable)

- **Permission request is deferred** — don't ask on first launch. Ask when
  the first event that would trigger a notification occurs.
- **Per-channel toggles** — user controls which notifications they receive
  (UI in task 58).
- **No backend required** — these are all local notifications.
- **Notification content is actionable** — include enough info that the user
  doesn't have to open the app to understand what happened.

## Acceptance

- [ ] Notification fires on tx confirmation (when app is backgrounded).
- [ ] Notification fires on tx failure/drop.
- [ ] Notification fires on new unlimited approval detection.
- [ ] Tapping notification opens relevant screen.
- [ ] Notification permission requested at appropriate time.
- [ ] Per-channel enable/disable works.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Remote/push notifications (task 57).
- Notification settings UI (task 58).
- WC background request notifications (platform task P3).

## Depends on

- Task 35 (pending tx tracker — for tx status events).
- Task 48 (approval management — for approval detection events).

# Task 58 — Notification settings screen + per-channel toggles + price alerts

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.10

## Why this matters

Users need control over which notifications they receive. This is both a UX
requirement and a platform store requirement (iOS/Android notification guidelines).

## Scope

Create:

- `app/settings/notifications.tsx` — notification settings screen:
  - Per-channel toggles grouped by category:
    - **Transactions**: confirmed, failed/dropped.
    - **Security**: new approval detected, connected dApp flagged.
    - **Transfers**: token received, NFT received.
    - **Market**: price alerts (default OFF).
  - Each toggle syncs to both local storage and backend preferences.
  - "Test notification" button for debugging.
  - Link to system notification settings if OS-level permissions are off.
- Price alert configuration:
  - Select tokens to watch (from portfolio).
  - Threshold setting: ±5%, ±10%, ±20% (default ±10%).
  - Alert frequency: at most once per hour per token.
- Master "Pause all" toggle — temporarily disable all notifications without
  losing per-channel settings.

## Rules (non-negotiable)

- **Security alerts cannot be disabled** via per-channel toggles. They are
  always on. Show them as non-toggleable with an explanation.
- **Settings sync to backend** for remote notifications (task 57).
- **Default states**: all ON except price alerts (OFF).
- **Respect OS permissions** — if user denied notifications at OS level, show
  a banner explaining how to re-enable.

## Acceptance

- [ ] Settings screen shows all channels with toggles.
- [ ] Per-channel toggles persist and sync to backend.
- [ ] Security alerts shown as always-on (non-toggleable).
- [ ] Price alert configuration works (token select, threshold).
- [ ] "Pause all" toggle works without losing individual settings.
- [ ] OS permission status displayed correctly.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing price monitoring backend (backend task).
- In-app notification center.

## Depends on

- Task 56 (local notifications), Task 57 (remote notifications).

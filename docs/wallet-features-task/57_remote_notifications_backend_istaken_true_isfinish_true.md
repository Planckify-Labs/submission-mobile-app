# Task 57 — Remote notifications + backend FCM/APNs gateway

**Status:** Not taken
**Owner:** Mobile (mobile-app) + Backend (takumipay-api)
**Spec reference:** `wallet-features-spec.md` §4.10
**Type:** Platform integration required

## Why this matters

Some notifications require server-side detection: incoming token/NFT transfers,
WC session requests when backgrounded, security alerts. These need a backend
push notification gateway.

## Scope

### Mobile side

- Register FCM/APNs token on app launch via `expo-notifications`.
- Send device token + wallet address to `takumipay-api` notification endpoint.
- Handle incoming remote notifications:
  - `token-received`: "Received X USDC from 0x1234".
  - `nft-received`: "Received [NFT name] from 0x1234".
  - `security-alert`: "A dApp you connected to has been flagged as malicious".
  - `price-alert`: "[TOKEN] moved > ±10%" (default OFF).
- Deep link from notification tap → relevant screen.

### Backend side (takumipay-api)

- New `notifications` module:
  - `POST /notifications/register` — accept FCM token + wallet address.
  - `POST /notifications/preferences` — per-channel toggles.
  - Webhook receiver for indexer events (incoming transfers).
  - Fire FCM/APNs push when events match user preferences.
- Minimal gateway scope — thin wrapper, not a full notification service.

## Rules (non-negotiable)

- **FCM token refresh** — re-register on token change.
- **User preferences synced** — backend respects per-channel toggles.
- **Security alerts are always ON** — user cannot disable critical security
  notifications.
- **Price alerts default OFF** — opt-in only.

## Acceptance

- [ ] FCM/APNs token registered with backend.
- [ ] Remote notification received for incoming token transfer.
- [ ] Remote notification received for incoming NFT.
- [ ] Security alert notification works.
- [ ] Price alert notification works (when opted in).
- [ ] Notification tap deep links to correct screen.
- [ ] Backend endpoint exists for registration and preferences.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- In-app notification center (v1.1).
- Scheduled digest notifications.

## Depends on

- Task 56 (local notifications — shared channel infrastructure).
- Platform: Firebase project setup (platform task P3).

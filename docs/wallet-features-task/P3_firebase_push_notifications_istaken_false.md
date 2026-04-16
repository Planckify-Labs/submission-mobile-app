# Platform Task P3 — Firebase project + push notification setup

**Status:** Not taken
**Owner:** Infrastructure + Mobile
**Spec reference:** `wallet-features-spec.md` §4.10
**Type:** Platform integration

## Why this is separate

Remote push notifications (incoming transfers, WC background requests, security
alerts) require Firebase Cloud Messaging (FCM) for Android and APNs for iOS.
This involves platform-level setup outside of code.

## Scope

- Create or configure Firebase project for TakumiAI Wallet.
- Enable Cloud Messaging (FCM).
- Generate and configure:
  - Android: `google-services.json` in the Expo project.
  - iOS: APNs key or certificate uploaded to Firebase.
- Configure `expo-notifications` for push:
  - `android.googleServicesFile` in `app.config.ts`.
  - iOS push notification entitlement.
- Verify end-to-end: backend sends test push → device receives notification.
- Set up WalletConnect push relay (for WC background session requests):
  - Register FCM server key with WalletConnect push server.

## Acceptance

- [ ] Firebase project configured with FCM enabled.
- [ ] Android receives remote push notifications.
- [ ] iOS receives remote push notifications.
- [ ] `expo-notifications` configured for both platforms.
- [ ] WC push relay configured (for backgrounded WC requests).
- [ ] End-to-end test: backend → FCM → device → notification displayed.

## Depends on

- None (can start early).

## Unblocks

- Task 57 (remote notifications).
- Task 49 (WC push for background requests).

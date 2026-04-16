# Task 31 — Signed push notifications; no signature deeplinks from push

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-054, §7, §9

## Why this matters

Push notifications are a trusted UI surface with no cryptographic
provenance by default. "Security alert" phishing notifications trick
users into tapping into a spoofed in-app page that solicits a
signature. The defence is twofold: every notification the wallet
handles must be cryptographically signed by a backend key pinned in
the app, AND the set of deeplinks reachable from a push must exclude
any signature-producing route.

## Scope

- Add a notification-signing key pair (server private in KMS; public
  pinned in the app). See spec §9 for key-management notes.
- Extend the push handler (new or existing — see spec §9) to:
  - Verify the signature over the notification payload before any
    in-app rendering or deeplink follow.
  - Drop (and log) any unsigned or invalid-signed payload; show no
    toast, no banner.
- Constrain the deeplink router: the set of routes reachable from a
  push payload is an allowlist of read-only screens (balances, tx
  detail, chain status). Any attempt to land on a signer-UI route
  from a push short-circuits to a "You came from a notification —
  open the app and repeat your action" interstitial.
- Add onboarding copy in Settings / Notifications: "We will never
  push you to sign something via a notification."
- Expose a dev-only diagnostic in Settings to view the last-received
  notification's signature-verification result.

## Rules (non-negotiable)

- Unsigned or bad-signature notifications MUST be dropped. No
  fallback UI.
- No signature-producing route is reachable from a push deeplink —
  enforce via allowlist, not denylist.
- Pinned public key is shipped in the binary; rotation requires a
  new app release.

## Acceptance

- [ ] Signature verification runs before any rendering of push
      payload content.
- [ ] Unsigned / invalid notifications are dropped silently and
      logged (no PII).
- [ ] Deeplink router refuses to land on signer-UI routes when the
      navigation source is a push.
- [ ] Notifications settings screen shows the onboarding copy.
- [ ] Regression: legitimate signed notifications land on the
      expected read-only route.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Transparency-log publication of notification payloads.
- Key-rotation tooling (this task pins a single public key).
- Push-provider-specific UX (APNs vs FCM branding / rich media).

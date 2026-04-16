# Task 21 — Universal/App Links for sensitive deeplinks

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-024, §7, §9

## Why this matters

USENIX 2017 measured that only 2.2% of mobile app-links were correctly
verified. Custom URL schemes like `takumiai://` are not exclusively
registrable — a phishing app installed alongside the wallet can register
the same scheme and intercept WalletConnect pairing URIs, tx-request
deeplinks, and OAuth callbacks. Only Android App Links and iOS Universal
Links with verified `.well-known/assetlinks.json` / AASA files are
exclusive. The spec calls out `app.json` / `app.config.ts`, Apple AASA,
and Android `assetlinks.json` as the concrete files.

## Scope

- `app.config.ts` — declare an HTTPS-based associated domain for every
  sensitive deeplink target. Configure `ios.associatedDomains` with
  `applinks:<domain>` and Android `intentFilters` with
  `android:autoVerify="true"` on the HTTPS host.
- Host `.well-known/apple-app-site-association` (AASA) with the App ID
  (`TEAMID.BUNDLEID`) and the path patterns the app handles. Served over
  HTTPS, correct `Content-Type: application/json`, no redirect. See
  spec §6 TWV-2026-024 for the control.
- Host `.well-known/assetlinks.json` with the Android package name and the
  SHA-256 signing-cert fingerprint of the release build (EAS-built APK).
  Must be reachable under the same HTTPS host.
- `services/deeplinks/` — every incoming deeplink must route through a
  preview screen (never auto-execute). Unknown routes fall back to home
  with a warning, per spec §6 applicability note.
- WalletConnect pairing — verify the pairing URI against an allowlist of
  relay hosts. Reject pairings that arrive from a source the user did not
  initiate (push, SMS, unknown deeplink).
- Strip any URL fragment that could encode signature material, raw private
  keys, or seed material. Reject outright if present.
- Keep custom `takumiai://` only as a non-sensitive fallback (e.g. OAuth
  return, non-authed navigation). No sensitive action may live under the
  custom scheme alone.

## Rules (non-negotiable)

- Every sensitive deeplink (send, sign, WalletConnect pair, chain add)
  MUST resolve via an HTTPS Universal/App Link, not a custom scheme.
- Expo Router routes MUST be declared; undeclared routes MUST fall back to
  home with a warning, not silently accept params.
- A deeplink MUST open a preview screen. No deeplink auto-executes a tx
  or signature.
- The AASA and `assetlinks.json` files are release-blocking artefacts and
  MUST be redeployed when signing certs rotate.

## Acceptance

- [ ] `app.config.ts` declares `ios.associatedDomains` with `applinks:`
      and Android intent filters with `autoVerify="true"`.
- [ ] AASA and `assetlinks.json` are checked into the infra repo (or the
      documented host) with correct App ID / package / SHA-256.
- [ ] Tapping a sensitive HTTPS deeplink opens the wallet directly on
      iOS / Android with the preview screen, not a system chooser.
- [ ] Deeplinks carrying raw seed / private-key material are rejected
      before routing, and a warning is logged (no seed value in the log).
- [ ] WalletConnect pairing URIs are validated against the relay-host
      allowlist before the pair prompt renders.
- [ ] pnpm check:syntax passes.

## Out of scope

- App-store impersonation monitoring (task 37, TWV-2026-020).
- Signing-mode profile that disables deeplinks entirely (task 26,
  TWV-2026-035).
- Signed push notifications (task 31, TWV-2026-054).

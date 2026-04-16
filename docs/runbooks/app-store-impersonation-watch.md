# App-store impersonation monitoring — TWV-2026-020

**Owner:** Trust & Safety / mobile-app · **Spec ref:** TWV-2026-020.

> **Status:** Operational runbook. No code change in the wallet repo.
> A clone of the wallet binary on the App Store / Play Store cannot
> be detected from inside the wallet — it has to come from external
> monitoring.

## What we monitor

1. **App Store search**: weekly automated query for "takumi" on the
   US, EU, JP, CN, ID storefronts. Capture every hit; diff against
   last week's set.
2. **Play Store search**: same, broader because Android sideloading
   makes mass cloning trivial. Add Aptoide + APKMirror to the watch
   list.
3. **Domain monitoring**: ScamSniffer / DomainTools alerts for any
   newly-registered domain matching `takumi*` / `takumiwallet*`,
   including punycode variants (TWV-2026-052).
4. **GitHub / GitLab / Bitbucket**: Search for forks of the
   takumi-mobile-app repo that flip a bundle ID or signing key.

## Triage workflow

When a new hit appears on any monitor:

1. Verify it isn't us (legit regional listing, official partner).
2. If impersonation: file a takedown via the appropriate channel:
   - App Store: report.apple.com/feedback (Counterfeit Application)
   - Play Store: support.google.com/googleplay/android-developer/answer/2666351
   - Domain: registrar abuse contact + CloudFlare / Vercel
     trust-and-safety
3. Push a notification to existing users via the official wallet
   warning channel (TWV-2026-054 signed-push) — "an impersonator app
   is on the store, do NOT install".
4. Update `services/security/scamDomainFeed.ts` `FALLBACK_FLAGGED`
   set with the impersonation domain in the next release.

## Cadence

- Weekly automated sweep.
- On-call rotation acknowledges each alert within 24h.
- Quarterly review of the watch list — add new keywords as the brand
  expands.

## Review gate

Any PR that changes the wallet's brand identity (name, icon, bundle
id) MUST update this watch list before merge.

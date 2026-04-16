# Task 37 — App-store impersonation monitoring

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-020, §7, §9

## Why this matters

Lookalike wallet apps and extensions drained real users across 2025
(40+ malicious Firefox add-ons impersonating MetaMask/Trust/Phantom
in Jul 2025; Trust Wallet Chrome Extension poisoned update Dec 2025).
Brand impersonation is a distribution-layer attack we cannot fix in
code — we defend by registering brand everywhere preemptively,
monitoring for copycats, and shipping an in-app SHA-256 that savvy
users can verify. This task writes the standing operational
procedure.

## Scope

Operational/policy task. Deliver:

- A `docs/runbooks/store-impersonation-watch.md` covering:
  - Authoritative list of store listings we own (Apple App Store,
    Google Play, Microsoft Store, Firefox AMO, Chrome Web Store if
    ever applicable), recorded by bundle ID / package name / add-on
    ID.
  - Preemptive brand-hold registrations for the same identifiers on
    adjacent stores we don't ship to, so squatters can't claim
    `takumiaiwallet` elsewhere.
  - Monthly search cadence on each store for: "takumi", "takumi
    wallet", "takumiai", common typosquats; document the checklist,
    the searcher's rotation, and the escalation path (store takedown
    form URLs) in the runbook.
  - Reporting template for when a copycat is found: evidence
    collection, store-abuse submission, public-advisory draft.
- Coordinate with Task 64 (TWV-2026-065) so the About screen's
  SHA-256 disclosure is the canonical anti-impersonation artefact
  users can verify.
- Flag TWV-2026-020 as a review gate on any marketing/distribution
  change (new store, new brand name, new deep-link domain).

## Rules (non-negotiable)

- Official distribution links are the single source of truth; every
  support/marketing channel links back to them.
- Brand-hold registrations are renewed before expiry; renewal dates
  tracked in the runbook.
- Every copycat report is logged in the runbook even if declined by
  the store — we need a time series for pattern detection.

## Acceptance

- [ ] `docs/runbooks/store-impersonation-watch.md` landed.
- [ ] Named owner assigned for the monthly sweep (rotation allowed,
      but next-up person is always listed).
- [ ] Store-abuse submission URLs collected and recorded.
- [ ] Brand-hold registrations enumerated with their next renewal
      date.
- [ ] Escalation path documented (who signs the public advisory,
      where it's posted).
- [ ] pnpm check:syntax passes.

## Out of scope

- Buying takedown-as-a-service tooling (re-evaluate if volume spikes).
- Legal trademark filings outside current jurisdictions.
- Backend certificate-transparency-style signed build metadata
  endpoint (listed as a "consider" item in spec §6; tracked
  separately if scoped).

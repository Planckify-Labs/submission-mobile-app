# Task 40 — DNSSEC / RPKI on owned infra

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-027, §7, §9

## Why this matters

MyEtherWallet lost ~$150k in two hours in April 2018 when an attacker
announced a more-specific BGP prefix to hijack AWS Route 53 and
served a phishing site under the victim domain. BGP and DNS have no
built-in authentication; RPKI and DNSSEC close the holes for the
domains we own. The mobile app is partially protected by SSL pinning
(Task 23, TWV-2026-026), but the backend surfaces — TakumiPay API,
Agent API, marketing domains — need the network-layer signatures too.
This is a platform-team coordination task the mobile repo tracks as a
dependency.

## Scope

Cross-team coordination/policy task:

- Write `docs/runbooks/dns-bgp-posture.md` listing:
  - Every domain the project owns: `takumiaiwallet.com` (and
    variants), API hostnames, agent hostname, marketing subdomains.
  - Registrar and DNS provider per domain; whether DNSSEC is enabled
    today; the target state and the owner on the platform team.
  - IP prefixes (if any) the project originates; target RPKI ROA
    coverage and the responsible AS owner.
  - HSTS-preload status for each user-facing domain; submission
    checklist.
- Coordinate with Task 23 (SSL/SPKI pinning, TWV-2026-026) so mobile
  cert pins and DNS posture are rotated together — the runbook
  specifies the joint rotation cadence.
- Add a Certificate Transparency monitoring entry (crt.sh or
  equivalent) per domain in the runbook, with the alert destination.
- Flag TWV-2026-027 as a review gate on any new domain or any DNS
  provider migration.

## Rules (non-negotiable)

- Any new user-facing domain is DNSSEC-enabled at creation, not
  retrofitted later.
- Mobile cert pins and DNS rotation are coordinated — never rotate
  one without a plan for the other.
- CT monitoring alerts are routed to on-call, not a silent mailbox.
- The runbook is the source of truth; drift from it is a finding.

## Acceptance

- [ ] `docs/runbooks/dns-bgp-posture.md` landed with the full
      domain/ASN inventory.
- [ ] Platform-team owner named per domain for DNSSEC and (where
      applicable) RPKI.
- [ ] CT monitoring configured for every user-facing domain; alert
      destination recorded.
- [ ] Joint rotation cadence with Task 23 (cert pins) documented.
- [ ] HSTS-preload submissions tracked to completion in the runbook.
- [ ] pnpm check:syntax passes.

## Out of scope

- Actually enabling DNSSEC at the registrar (platform-team action
  tracked via the runbook; this task lands the spec + plan).
- Launching new infrastructure or migrating DNS providers.
- Web-frontend SRI work (no public web frontend today; revisit if
  one ships).

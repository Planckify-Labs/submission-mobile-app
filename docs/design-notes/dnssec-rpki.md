# DNSSEC / RPKI on owned infra — TWV-2026-027

**Owner:** Infrastructure · **Spec ref:** TWV-2026-027.

> **Status:** DNS / network-infrastructure scope. No code change in
> the wallet repo.

## Hard rules

1. Every domain we operate (`takumi.wallet`, `*.takumi.wallet`,
   `*.takumipay.io`) is signed with DNSSEC. Resolvers that validate
   DNSSEC reject hijacked answers from upstream caches.
2. Every prefix announced by our ASNs is covered by a signed RPKI
   ROA (Route Origin Authorisation). Networks that filter on RPKI
   reject hijacked BGP announcements.
3. The CDN / hosting providers we use MUST themselves announce via
   ROA-covered prefixes. Audited annually.
4. NSEC3 with opt-out is acceptable; NSEC1 is not (zone-walking
   leaks subdomain enumeration).

## What this defends

- Resolver poisoning that maps `api.takumi.wallet` to an attacker
  IP — DNSSEC validation rejects.
- BGP hijack of our prefix that routes traffic through an attacker
  AS — RPKI filtering rejects.
- Subdomain enumeration leakage via DNS zone walking — NSEC3
  mitigates.

## Audit cadence

- Quarterly: re-confirm DNSSEC chain validates from root to our
  zones via `dig +sigchase` / `delv`.
- Quarterly: confirm RPKI ROAs are published + valid via
  `bgp.tools` / `rpki-validator`.
- Annually: third-party audit of registrar lock + DNS-provider
  account separation (no single account both holds the registrar
  lock AND can publish DNSSEC keys).

## Review gate

Any infra PR that adds a new public-facing domain MUST cite
TWV-2026-027 and document the DNSSEC + ROA setup before the domain
goes live.

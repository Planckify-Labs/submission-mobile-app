# Task 29 — Live scam-domain feed + pending-permits screen

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-051, §7, §9

## Why this matters

Industrial-scale drainers (Inferno, Pink, Angel) harvest Permit /
Permit2 signatures via lookalike airdrop claim sites, batch-execute
later, and users have no feedback loop because off-chain signatures
have no gas cost. Two defences, together: block signatures on flagged
origins using a live scam-domain feed, and surface a pending-permits
screen so users can revoke outstanding allowances before they are
burned.

## Scope

- Integrate a scam-domain feed (ScamSniffer / Blockaid / GoPlus — pick
  one or chain; see spec §9). Cache the feed locally with a short
  TTL; update in the background.
- Extend the dApp-browser origin check and the signer-UI origin
  display: if the origin is flagged, hard-block any
  signature-producing method (Permit, Permit2, `eth_sign`-class
  requests) and show a full-screen "This site is on a scam-domain
  feed" block with a "report false positive" link.
- Build `app/settings/pending-permits.tsx` (or similar — see spec §9)
  listing all active Permit2 allowances for the active wallet with a
  one-tap revoke (`invalidateNonces`) button. Refresh on app open.
- All Permit / Permit2 prompts run through the existing decoders
  (task 08) AND display the spender + amount explicitly; add a
  3-second cool-down timer before the Sign button enables.

## Rules (non-negotiable)

- Scam-domain feed is advisory only when the app is offline / feed is
  stale — fall back to the existing origin-reputation logic, do not
  soft-fail open for known-flagged cached entries.
- Pending-permits revoke MUST go through the signer-UI flow — no
  silent revoke.
- Feed lookups must not leak the user's address to the feed
  provider (hash the domain only; do not include the wallet address
  in the request).

## Acceptance

- [ ] Background task updates the scam-domain feed cache on a
      configurable interval.
- [ ] A flagged origin cannot initiate a Permit / Permit2 signature —
      the block screen is shown.
- [ ] Pending-permits screen lists active Permit2 allowances and
      revoke flows complete an on-chain `invalidateNonces`.
- [ ] 3-second cool-down is enforced on all Permit / Permit2 prompts.
- [ ] No outgoing network request includes the user's wallet address
      in scam-feed lookups.
- [ ] Regression: benign origins and flows unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- ERC-20 `approve` pending-allowances screen (separate task — see
  task 15).
- Feed provider A/B selection + attribution UI.
- Paid-tier rules for Blockaid / GoPlus APIs.

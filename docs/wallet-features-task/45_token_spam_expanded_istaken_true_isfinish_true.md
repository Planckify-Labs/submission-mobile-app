# Task 45 — Expanded spam filtering: phishing names, honeypot, quarantine

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.11c

## Why this matters

Basic spam filtering (task 32) catches obvious spam. This task adds advanced
detection: phishing token names ("Claim at X"), honeypot simulation, and an
airdrop quarantine system.

## Scope

Extend `services/tokens/spamFilter.ts` and create new modules:

- **Phishing token names**: detect tokens whose name contains patterns like
  "Claim at <url>", "Visit <url>", "Redeem at <url>", "Airdrop from <url>".
  Regex-based detection. Auto-hide + `danger` badge if displayed.
- **Honeypot detection** (`services/tokens/honeypotDetector.ts`):
  - Simulate `approve` + `transferFrom` via `eth_call` for suspicious tokens.
  - If simulation reverts or returns false → badge as "Cannot be transferred —
    possible honeypot".
  - Run only for tokens in the "Discovered" section, not for default-list tokens.
  - Cache honeypot status in `expo-sqlite` (check once per token, valid 7 days).
- **Airdrop quarantine**:
  - Tokens received via airdrop (no user-initiated interaction — no matching
    `BridgeEvent` or outbound tx to the token contract) go to a "Received"
    quarantine tab in portfolio.
  - User explicitly moves tokens to portfolio via "Trust this token" action.
  - Interacting with quarantined tokens (trying to send/swap) shows a warning:
    "This token was received unsolicited. Interacting with it may be risky."
- Update `components/portfolio/SpamBadge.tsx` to handle new badge types:
  `phishing`, `honeypot`, `quarantined`.

## Rules (non-negotiable)

- **Honeypot simulation is best-effort** — don't block the UI waiting for it.
  Show token normally, badge appears async when simulation completes.
- **Quarantine does not delete tokens** — user can always access them.
- **Phishing regex must not false-positive on legitimate tokens** that contain
  URLs in their name (e.g., "mirror.xyz" governance token). Require patterns
  like "claim", "visit", "redeem" + URL structure.
- **No network calls for phishing detection** — regex is local.

## Acceptance

- [ ] Phishing names detected: "Claim at evil.com" flagged; "Mirror" not flagged.
- [ ] Honeypot simulation runs for discovered tokens; honeypots badged correctly.
- [ ] Airdropped tokens appear in quarantine tab.
- [ ] "Trust this token" moves token from quarantine to portfolio.
- [ ] Warning shown when interacting with quarantined tokens.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- ML-based spam classification.
- Reporting spam to a central service.

## Depends on

- Task 32 (basic spam filtering).

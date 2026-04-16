# Task 44 — Address-poisoning detection in history + send flow

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.11b

## Why this matters

Address poisoning is a growing attack vector: attackers send 0-value transfers
from addresses that share the first/last 4 characters of addresses the user
frequently interacts with. Users copy the wrong address from history and send
funds to the attacker.

## Scope

Create:

- `services/security/addressPoisoning.ts`:
  - `checkPoisoning(address: string, context: PoisoningContext): PoisoningResult`
  - `PoisoningContext` includes: user's contact list, recent counterparties
    (from history).
  - Detection logic: compare first 4 and last 4 hex characters of the incoming
    `from` address against all known counterparties + contacts. If first/last 4
    match but full address differs → flag as potential poisoning.
  - `PoisoningResult`: `{ isPoisoning: boolean, similarTo?: { address, label } }`.
- History integration (`components/history/TransactionRow.tsx`):
  - On incoming transfers, run poisoning check.
  - Flagged transfers get a warning badge: "Possible address poisoning".
  - Tapping the badge shows an explanation of the attack.
- Send flow integration (`components/send/RecipientInput.tsx`):
  - When user pastes an address, check against poisoning patterns.
  - If match: show `danger` annotation: "This address looks similar to
    [contact name] but is different. Verify carefully."
  - Do not block sending — warn only.

## Rules (non-negotiable)

- **Compare first 4 AND last 4 characters** — both must match for a flag.
  Only first or only last is too aggressive (high false-positive rate).
- **Never block a transaction** based on poisoning detection — warn only.
  The user may legitimately interact with similar-prefix addresses.
- **Detection is local-only** — no network calls. Runs against cached contacts
  and recent history.
- **Explanation must be user-friendly** — no jargon. "This address looks
  similar to [name] but is a different address. Scammers sometimes create
  lookalike addresses to trick you."

## Acceptance

- [ ] Poisoning detection correctly flags addresses with matching first/last 4 chars.
- [ ] Does not flag addresses where only first OR only last chars match.
- [ ] Warning badge appears on flagged history rows.
- [ ] Send flow shows danger annotation when pasting a poisoning-pattern address.
- [ ] Explanation dialog is clear and non-technical.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Blocking or hiding poisoned transactions (warn only).
- ML-based poisoning detection.

## Depends on

- Task 42 (address book — for contact list comparison).
- Task 34 (transaction history — for recent counterparties).

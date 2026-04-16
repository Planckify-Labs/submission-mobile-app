# Task 20 — Clipboard-swap detection + middle-char address display

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-022, §7, §9

## Why this matters

"Laplas Clipper" and successors earned $560k+ from a single campaign by
silently swapping copied addresses for attacker-owned lookalikes with
matching prefix/suffix. iOS <14 and Android 10+ both allow clipboard reads
from any foreground app with permission. The TakumiAI address-book hook
exists at `hooks/useAddressBook.ts` and `services/security/addressPoisoning.ts`
already covers on-chain zero-value poisoning, but the spec explicitly calls
out that clipboard-swap is not yet audited there. Users who paste a
recipient address are one frame short of signing a drain.

## Scope

- `services/security/addressPoisoning.ts` — extend to cover paste events.
  Add a `detectClipboardSwap(pastedAddress, context)` that compares the
  pasted value against recent tx recipients, contacts
  (`hooks/useAddressBook.ts`), and the active wallet's own addresses, and
  flags slight Levenshtein distance (prefix/suffix match with differing
  middle chars) as high-risk.
- Send flow — the recipient input that accepts paste must render the
  address in a middle-4 display: `0x1234…abcd` plus characters 5–8 and
  -8:-4 of the address. Attacker vanity generators match first/last 4 only;
  revealing a middle window raises the cost of lookalike substitution.
- "Review full address" modal — before send confirmation, show the full 40
  hex chars in groups of 4; user must scroll to end and tap confirm. No
  auto-confirm on paste.
- Clipboard hygiene — after the app itself copies an address, schedule
  `Clipboard.setStringAsync('')` 30s later to reduce residue (spec §6).
- Warn loudly (non-dismissable banner with distinct confirm action) when
  `detectClipboardSwap` returns a hit against a contact or recent recipient.

## Rules (non-negotiable)

- Paste MUST NOT auto-populate and proceed. The middle-4 display plus the
  review modal MUST appear before any tx is built.
- The Levenshtein check MUST run against contacts + recent recipients, not
  only the currently selected contact.
- The warning banner MUST require a distinct confirm action, not the same
  primary "Continue" button.
- Do not auto-read clipboard on app foreground — task 63 tracks that
  separately (TWV-2026-063); this task only handles explicit paste events.

## Acceptance

- [ ] Pasting an address with edit distance ≤ 4 from a contact triggers
      the warning banner with a distinct confirm action.
- [ ] The recipient input renders `0x1234…5678…abcd` (middle-4 window).
- [ ] The "Review full address" modal displays all 40 hex chars in groups
      of 4 and requires scroll-to-end before confirm.
- [ ] Addresses copied from within the app are cleared from the clipboard
      after 30 seconds.
- [ ] Unit tests cover the Levenshtein matcher across the address book and
      recent-recipients list.
- [ ] pnpm check:syntax passes.

## Out of scope

- Clipboard auto-read on foreground (task 63, TWV-2026-063).
- QR-scan-only send mode (task 26 signing-mode profile, TWV-2026-035).
- ENS / contact-book changes beyond the Levenshtein read path.

# Task 27 — ATA program decoder + RecoverNested hijack detection

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.4 inv 7.

## Why this matters

Associated Token Accounts are pervasive (every SPL transfer implicitly
creates one). Decoding them lets the sheet say "Create USDC account
for {recipient}" instead of "ATA program invoked". More importantly,
`RecoverNested` is a known draining pattern — a malicious dApp
sandwiches a user transfer with a RecoverNested that drains the
nested ATA to an attacker-controlled wallet. Invariant 7 requires
this to render as `danger`.

## Scope

- `services/chains/solana/programDecoder.ts` — ATA program branch
  (`ATokenGPv…`):
  - `Create` → "Create associated token account for {owner} +
    {mint}".
  - `CreateIdempotent` → same, with no-op flag when account already
    exists.
  - `RecoverNested` → "Recover nested token account {nested} → owner
    {ownerOf}".
- **Danger rules** (invariant 7):
  - `RecoverNested` when the `ownerOf` account ≠ active wallet →
    `danger: "Close-authority hijack — nested ATA will move to
    {ownerOf}, not your wallet"`.
  - `CreateIdempotent` with a `wallet` parameter that doesn't match
    the signing wallet and without an obvious legitimate purpose
    (heuristic) → `warn`.
- Fixture tests:
  - Create ATA for common USDC transfer → normal info row.
  - RecoverNested to attacker address → danger.
  - CreateIdempotent same-wallet → info, no warn.

## Rules (non-negotiable)

- **Invariant 7 is a P0 security rule.** RecoverNested with foreign
  `ownerOf` must render as `danger`, not `warn`.
- **ATA program instruction decode uses `@solana-program/token`
  helpers.** No hand-rolled binary parsing.
- **Unknown ATA-program instruction → `{ kind: "unknown" }`
  fallback** (invariant 23).

## Acceptance

- [ ] Fixture: sandwich attack (transfer + RecoverNested to attacker)
      → danger banner in sheet.
- [ ] Fixture: legit same-owner CreateIdempotent → no warn.
- [ ] Fixture: transfer + Create for recipient → two info rows.

## Out of scope

- Close-authority manipulation of the underlying mint (Task 14 covers
  the `MintCloseAuthority` extension).

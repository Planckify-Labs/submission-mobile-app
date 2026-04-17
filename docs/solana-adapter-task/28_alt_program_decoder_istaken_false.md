# Task 28 — Address Lookup Table program decoder

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.2.

## Why this matters

Rare but real — Jupiter's Limit Order builder and some MEV tools
ask the user to sign ALT lifecycle instructions (`CreateLookupTable`,
`ExtendLookupTable`, `CloseLookupTable`). Without this decoder these
render as "AddressLookupTab1e…" with opaque data bytes, blocking
informed approval.

## Scope

- `services/chains/solana/programDecoder.ts` — ALT program branch
  (`AddressLookupTab1e…`):
  - `CreateLookupTable` → "Create lookup table {newTable} with
    authority {authority}".
  - `ExtendLookupTable` → "Add {N} addresses to lookup table
    {table}" with first-few-addresses preview.
  - `FreezeLookupTable` → "Freeze lookup table {table} (no more
    extends)".
  - `DeactivateLookupTable` → "Deactivate lookup table {table}".
  - `CloseLookupTable` → "Close lookup table {table}, rent recipient
    {recipient}".
- **Danger rules:**
  - `CloseLookupTable` where `recipient ≠ signingWallet` → `warn:
    "Lookup table rent will go to {recipient}, not your wallet"`.
  - No `danger`-class rules — ALT operations aren't drain vectors by
    themselves.
- Uses `@solana-program/address-lookup-table` helpers.

## Rules (non-negotiable)

- **No ALT-specific `danger` unless the op actually drains.** Over-
  flagging rare-but-legit flows trains users to ignore warnings.
- **Decoder invokes no RPC.** Purely local; the resolver (Task 10)
  handles read.
- **Unknown ALT-program instruction → fallback.** (Invariant 23.)

## Acceptance

- [ ] Fixtures for all 5 instructions.
- [ ] CloseLookupTable-to-3rd-party → warn annotation.
- [ ] Jupiter Limit Order builder manual smoke — readable instructions
      in sheet.

## Out of scope

- ALT expansion / read (Task 10).

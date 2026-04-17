# Task 25 — Jito tip account display

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §8 Q3.

## Why this matters

Users on Jito-enabled dApps (Jupiter's Jito route, Tensor's priority
bundles) pay a Jito tip that today renders as an anonymous
`SystemProgram::transfer` to a random-looking address. Displaying it
as "Jito tip: 0.0042 SOL" restores visibility into what the user is
actually paying without originating any Jito-specific submission
logic.

## Scope

- `services/chains/solana/jitoTipAccounts.ts`:
  - Hard-coded export of the 8 published mainnet Jito tip account
    addresses (per jito.wtf docs).
  - `isJitoTipAccount(address: Address): boolean`.
  - One-line source comment linking to `jito.wtf/docs` so
    regeneration is obvious. Bumped on spec revision (per §8 Q3
    recommendation).
- `SolanaSimulationInspector` / `SolanaTransactionSheet`:
  - For any decoded `system:transfer` whose destination is in the
    Jito tip set: tag that instruction's summary as "Jito tip:
    {lamports → SOL} to {truncated address}".
  - In the sheet, surface a dedicated "Jito tip" row above generic
    transfers (not in the generic Transfers section).
- `jitoTipAccounts.test.ts` — assert the eight addresses are exactly
  the set published; add a fixture tx with one of them and assert
  the sheet tags it correctly.

## Rules (non-negotiable)

- **Display-only.** We do not originate bundle submission. No Jito
  Block Engine calls. dApps continue posting to Jito directly.
- **Hard-coded list.** §8 Q3 — fetching on boot is wasteful; change
  with spec revision. Source comment documents the provenance.
- **No mainnet / testnet difference.** Jito tip accounts are
  mainnet-only; testnet / devnet fixtures do not match the list.
- **Never hide the underlying instruction.** The generic transfer
  row still appears for audit; the Jito row is an enrichment, not a
  replacement.

## Acceptance

- [ ] All 8 hard-coded addresses verified against jito.wtf at time
      of writing.
- [ ] Fixture: tx with a Jito tip transfer → "Jito tip" row in sheet.
- [ ] Devnet tx with identical-looking address → not tagged (since
      tip accounts are mainnet-only).
- [ ] Sheet renders both the Jito tip row and the generic transfer
      instruction.

## Out of scope

- Jito bundle submission / first-party MEV protection (deferred,
  see §9).

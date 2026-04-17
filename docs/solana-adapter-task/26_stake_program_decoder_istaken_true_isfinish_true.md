# Task 26 — Stake program instruction decoders

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.2.

## Why this matters

Marinade, Jito-staking, native-stake flows all use the Stake program
(`Stake11111…`). Today these render as "Stake program invoked" —
useless. Decoding each instruction into "Delegate 10 SOL to validator
{voteAccount}" / "Deactivate {stakeAccount}" / etc. is a GA blocker
for any native-staking dApp.

## Scope

- `services/chains/solana/programDecoder.ts` — extend with Stake
  program branch (`Stake11111111111111111111111111111111111111`):
  - `Initialize` → "Initialize stake account {account}".
  - `Authorize` (staker / withdrawer) → "Change {role} authority to
    {newAuthority}".
  - `DelegateStake` → "Delegate {stakeAccount} to validator
    {voteAccount}".
  - `Split` → "Split {lamports} from {source} to {destination}".
  - `Withdraw` → "Withdraw {lamports} to {destination}".
  - `Deactivate` → "Deactivate {stakeAccount}".
  - `Merge` → "Merge {source} into {destination}".
  - `AuthorizeWithSeed` → variant of Authorize.
- `SolanaTransactionSheet` — render the human strings directly.
- Fixture tests:
  - Marinade stake-deposit tx → DelegateStake row.
  - Native unstake tx → Deactivate row.
  - Merge tx → correctly decoded accounts.
- **Danger rules:**
  - `Authorize` changing withdrawer authority to ≠ signing wallet →
    `danger: "Withdraw authority changed — only {newAuth} can unstake"`.

## Rules (non-negotiable)

- **Never decode a non-Stake-program instruction via this branch.**
  Dispatch is on `programId`; wrong branch is a bug.
- **Unknown stake instruction → `{ kind: "unknown" }` fallback,
  never silently hide.** Invariant 23.

## Acceptance

- [ ] All 7 instruction variants have fixtures decoding to expected
      text.
- [ ] Withdraw authority change to non-signer → danger annotation.
- [ ] Marinade / Jito-staking manual smoke test — one stake, one
      unstake per test.

## Out of scope

- Originating stake operations from first-party features.
- Validator-name resolution (separate enrichment; nice-to-have).

# Task 30 — SNS (`.sol`) domain resolver

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.4 inv 22.

## Why this matters

Some dApps inline `.sol` domains into memos or custom-program args
as destination hints ("send to takumi.sol"). Rendering the raw
base58 alongside the domain label restores what the user is agreeing
to. Resolution must be advisory — the actual signature goes against
the resolved base58, never the domain string (invariant 22).

## Scope

- `services/chains/solana/sns.ts`:
  - `resolveSnsDomain(name: string, rpc: SolanaRpc):
    Promise<Address | null>` — uses Bonfida's on-chain resolution
    (read the SNS registry account for the hash-derived PDA).
  - `isSnsDomain(value: string): boolean` — regex `/^[a-z0-9][a-z0-9-]{0,61}\.sol$/i`.
  - Cache via `solanaRpcPool` read-only 5 min.
- Integration points:
  - Decoded instruction `data` fields: when the decoder emits an
    `address` type field that the SNS resolver recognises as
    `{x}.sol` in an adjacent memo: attach `resolvedName: "x.sol"`.
  - `SolanaTransactionSheet` rendering: `takumi.sol →
    9xyz…base58…` with both domain and address shown in full.
- **Failure handling:**
  - Missing registry account → `null`; sheet shows raw base58 with
    no label. Never invent a domain.
  - Homograph domains (`takum𐒄.sol` with Cyrillic look-alikes) →
    warn annotation `warn: "Domain contains mixed-script
    characters — verify address"`.

## Rules (non-negotiable)

- **Invariant 22: SNS is advisory, not authoritative.** Signature
  always goes against resolved base58. Never construct a tx from a
  domain string.
- **Resolved base58 always shown in full.** Domain is a label
  beside it; users see both.
- **Homograph class surfaces `warn`.** Confusables detection via
  Unicode script-property class.
- **No SNS fetch outside `rpc` proxy.** Same provenance discipline
  as every other on-chain read.

## Acceptance

- [ ] `takumi.sol` fixture resolves to expected address.
- [ ] `does-not-exist-0xyz.sol` → `null`; no label in sheet.
- [ ] Cyrillic-lookalike domain → warn in sheet.
- [ ] Manual: memo-field `takumi.sol` transfer renders with both
      label and address.

## Out of scope

- Reverse resolution (base58 → preferred .sol domain) — separate
  feature, not signing-critical.
- Non-Bonfida name services (AllDomains etc.) — future extension.

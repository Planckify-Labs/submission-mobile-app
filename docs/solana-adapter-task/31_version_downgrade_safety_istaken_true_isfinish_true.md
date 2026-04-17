# Task 31 — Version downgrade safety (v0 → legacy refusal)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.4 inv 14.

## Why this matters

A dApp that sends a legacy-format tx but references Address Lookup
Tables is malformed — legacy transactions can't resolve ALTs. Older
wallets sometimes silently "downgrade" v0 to legacy by stripping the
version marker, which breaks any ALT-using tx the user thought was
about to execute. Making the adapter refuse this at the boundary
catches the class of bugs once and for all.

## Scope

- `services/chains/solana/payloads.zod.ts` (from Task 21):
  - When parsing `SolanaSignTxPayload`:
    - Decode the base64 tx header via `@solana/kit`.
    - If header indicates v0 BUT payload declares `version: "legacy"`:
      reject `-32602 "transaction version mismatch (v0 tx with
      legacy declaration)"`.
    - If header is legacy BUT tx references ALTs (header bytes
      claim legacy, but the message body has `addressTableLookups`):
      reject `-32602 "transaction version mismatch (legacy header
      with lookup tables)"`.
- `SolanaAdapter.handleRequest`:
  - Error surfaces as `ChainResult.error(-32602)` before any
    inspector runs.
- Fixtures:
  - Legacy header + ALT references → reject.
  - v0 header + `version: "legacy"` declaration → reject.
  - Matching v0 + v0 declaration → accepted.
  - Matching legacy + legacy → accepted.

## Rules (non-negotiable)

- **Mismatch at the boundary = hard reject.** No inspector
  enrichment, no sheet. The tx is malformed; pretending to show it
  invites the downgrade attack.
- **Never re-serialise with a different version.** Adapter reads
  the tx as-is; any rewrite is banned.
- **Both directions checked.** The more common attack is legacy
  header with ALTs; the symmetric case is still wrong.

## Acceptance

- [ ] Fixture: v0 tx flagged as legacy by dApp → rejected.
- [ ] Fixture: legacy header + ALT references → rejected.
- [ ] Fixture: correctly declared v0 tx accepted normally.
- [ ] Fixture: correctly declared legacy tx accepted normally.

## Out of scope

- v0 `legacy` conversion features (we never convert).

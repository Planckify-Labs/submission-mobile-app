# Task 13 — `programErrors.ts` — three-tier decoded-error contract

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.9 (decoded error contract).

## Why this matters

`simulateTransaction`'s `err` field is unreadable JSON — `{
InstructionError: [0, { Custom: 1 }] }`. Surfacing this raw makes
simulation annotations look like crash dumps instead of actionable
messages. Anchor-based programs (half the Solana ecosystem) emit
structured errors in their logs that we can parse into human names.
This is what turns "Transaction will fail: `{Custom: 1}`" into
"Transaction will fail: insufficient funds".

## Scope

- `services/chains/solana/programErrors.ts`:
  - `decodeSimulationError(err: SimulationError, logs: string[]):
    DecodedError` → three tiers:
    1. **Per-program error table** — `programId → Record<errorCode,
       errorName>`. Ship tables for:
       - System program (`11111111…`) — `0x1` → `"insufficient
         lamports"`, etc.
       - SPL Token (`Tokenkeg…`) — `0x1` → `"insufficient funds"`,
         `0x3` → `"invalid mint"`, etc.
       - Token-2022 (`TokenzQ…`) — SPL set + extension codes.
       - ComputeBudget, ATA, Memo.
    2. **Anchor decoder** — scan `logs[]` for `Program log: AnchorError
       caused by account: X. Error Code: Y. Error Number: Z. Error
       Message: W.` Extract name + message.
    3. **Fallback** — `warn: "Program {programId} rejected the
       transaction (code 0x{hex})"` with the raw log bundle attached
       for a "Show logs" expander. Never silently swallow.
- `programErrors.test.ts`:
  - Fixture: System `InstructionError` → "insufficient lamports".
  - Fixture: Anchor log line → extracted name.
  - Fixture: unknown program → fallback text, full raw log preserved
    in `data`.

## Rules (non-negotiable)

- **Never silently swallow.** An unknown error code always surfaces
  the raw `programId + code` + raw log bundle.
- **Maintained alongside Solana program updates.** §4.9 — out of CI
  scope; an onboarding doc points contributors to the source-of-truth
  tables (`solana-program/*` repos).
- **Decoder output fits in `SolanaSimulationWarning` structure.**
  Decoded error is one warning among others in the
  `SolanaSimulationSummary`.

## Acceptance

- [ ] Three tiers each have at least two fixture tests.
- [ ] Fallback preserves raw log bundle.
- [ ] Used by `SolanaSimulationInspector` (Task 11) to populate
      warnings — plumbing test green.

## Out of scope

- UI rendering (Task 16 consumes the decoded warning).
- Updating tables for new Solana program versions — ongoing
  maintenance, not this task.

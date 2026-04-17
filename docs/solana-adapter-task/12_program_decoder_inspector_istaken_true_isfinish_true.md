# Task 12 — `programDecoder.ts` + inspector (System / SPL / Token-2022 / ComputeBudget / Memo)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.9, §10.2, §10.4 inv 7/23.

## Why this matters

`SolanaDecodedInstruction[]` is what turns `SolanaTransactionSheet`
from a raw base64 preview into "Transfer 1.23 SOL to {addr}". Purely
local work (no RPC), so it lands in parallel with simulation. The
base set of decoders here covers > 90% of instructions in the wild;
Phase 1c decoders (Stake / ATA / ALT / Metaplex) extend the same
file.

## Scope

- `services/chains/solana/programDecoder.ts`:
  - `decodeInstructions(tx: DecodedTransaction,
    resolvedAccounts: ResolvedAccounts): SolanaDecodedInstruction[]`.
  - **System program** (`11111111…`): `Transfer`, `CreateAccount`,
    `CreateAccountWithSeed`, `Assign`, `Allocate`,
    `AdvanceNonceAccount`, `WithdrawNonceAccount`,
    `AuthorizeNonceAccount`, `InitializeNonceAccount`. Uses
    `@solana-program/system`.
  - **SPL Token** (`Tokenkeg…`): `Transfer`, `TransferChecked`,
    `Approve`, `Revoke`, `SetAuthority`, `CloseAccount`, `Burn`,
    `MintTo`, `Freeze`, `Thaw`. Uses `@solana-program/token`.
  - **Token-2022** (`TokenzQ…`): same set + extension-aware
    instructions; uses `@solana-program/token-2022`.
  - **ComputeBudget** (`ComputeBudget1111…`):
    `setComputeUnitLimit`, `setComputeUnitPrice` →
    `SolanaDecodedInstruction { program: "compute-budget", kind, value }`.
  - **Memo** (`MemoSq4…`): raw utf-8 payload → `{ program: "memo",
    data: string }`.
  - **Unknown programs**: `{ program: programId, kind: "unknown",
    programName?: resolveProgramName(programId) }` with a curated
    allowlist (Jupiter / Drift / Magic Eden / etc.) for nice names.
- `services/bridge/inspectors/SolanaProgramDecoderInspector.ts`:
  - `name: "solana.decoder"`, `priority: 15`, `mode: "auto"`,
    `namespaces: ["solana"]`, `kinds: ["signTransaction",
    "sendTransaction", "signAllTransactions"]`.
  - Returns `InspectionResult.patch` with `payload.decoded` populated.
  - No network — purely local decode.
- `programDecoder.test.ts`:
  - System transfer fixture → correct recipient + lamports.
  - SPL `TransferChecked` fixture → decimals preserved.
  - ComputeBudget `setComputeUnitPrice` fixture → micro-lamports/CU
    extracted.
  - Unknown program → `kind: "unknown"` with program name when known.

## Rules (non-negotiable)

- **Unknown programs are always visible.** Invariant 23. Never
  silently render "Transaction" with zero instructions; a blank
  preview is indistinguishable from a drain.
- **No RPC calls.** Decoder is pure; account owner / mint metadata
  lookups happen elsewhere (simulation accounts, Token-2022 inspector).
- **Decoder output is additive.** Never mutates the raw tx. Sheet
  reads either `decoded` rows or raw base64 — both paths safe.
- **Priority 15 runs before simulation (20).** Decoded instructions
  are used by simulation inspector to compute writable accounts.

## Acceptance

- [ ] Fixture coverage ≥ the §10.2 P1b instruction table for these
      five programs.
- [ ] Unknown-program instruction produces a `{ kind: "unknown" }`
      entry with the programId in full.
- [ ] `pnpm run test -- programDecoder` green.

## Out of scope

- Stake / ATA / ALT / Metaplex decoders (Tasks 26–29).
- SPL Token-2022 extension annotation (Task 14).
- Decoded error parsing (Task 13).

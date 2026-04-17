# Task 11 — `simulate.ts` + `SolanaSimulationInspector`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.9, §10.4 inv 5/6/8/21.

## Why this matters

Simulation-first UX is the spec's guiding principle 4. Solana's
`simulateTransaction` is free and fast, returns the exact pre/post
state the dApp sees, and turns "blind base64 sign" into "you will
lose 1.23 SOL and gain 12,345 USDC". Every P1b signing sheet depends
on `intent.payload.simulation` being populated by this inspector.

## Scope

- `services/chains/solana/simulate.ts`:
  - `simulateAndSummarise(signedTxBase64, cluster, writableAccounts,
    rpc): Promise<SolanaSimulationSummary>`.
  - Calls `rpc.simulateTransaction(base64, { sigVerify: false,
    commitment: "confirmed", replaceRecentBlockhash: true,
    innerInstructions: true, accounts: { encoding: "base64",
    addresses: writableAccounts } })`.
  - Builds `balanceChanges[]` from pre/post `accounts[].lamports`.
  - Builds `tokenChanges[]` from `postTokenBalances -
    preTokenBalances`, tagging `tokenProgram` (spl-token vs
    token-2022 via mint-owner).
  - Emits `SolanaSimulationWarning[]`:
    - `writable.unknown-program` for any writable account whose owner
      is not a known program (System, SPL, Token-2022, ATA, Stake,
      Vote, ComputeBudget, Memo, known dApp program allowlist).
    - `nonce.authority-mismatch` when first instruction is
      `AdvanceNonceAccount` and authority ≠ signer.
    - `lookup-table.expanded` if ALT resolver added > 10 accounts
      (info — heads-up to users).
    - Token-2022 extension warnings (delegated to Task 14's
      `token2022.ts`).
    - `setAuthority` and `ata.close-authority-change` from decoded
      instructions (Task 12 decoder output).
- `services/bridge/inspectors/SolanaSimulationInspector.ts`:
  - `name: "solana.simulation"`, `priority: 20`, `mode: "auto"`,
    `namespaces: ["solana"]`, `kinds: ["signTransaction",
    "sendTransaction", "signAllTransactions"]`.
  - Writable-account list built from the tx's message +
    `altResolver.resolveLookupTables` (Task 10).
  - Returns `InspectionResult.patch` with `payload.simulation`
    populated.
  - On timeout (2 s pipeline): no patch, inspector result annotates
    `info: "Simulation timed out"`. Approve button stays live.
- `simulate.test.ts` — fixture transactions for pre/post diffing,
  including a Token-2022 transfer-fee case.
- **Simulation cache** — keyed by `sha256(signedTxBase64)`, TTL 30 s.
  Task 20 (broadcast) re-reads this cache for preflight.

## Rules (non-negotiable)

- **`transaction` field never modified.** `SECURITY_CRITICAL_FIELDS`
  in `inspector.ts:61-66` already includes `"transaction"` — simulation
  may only augment view, never swap tx. Invariant preserved.
- **Simulation cache is signature-keyed, never tx-keyed.** Invariant
  21 — a signature change must invalidate.
- **No broadcast side-effects.** Simulation is read-only.
- **`replaceRecentBlockhash: true`** — simulation ignores blockhash
  staleness so the user sees the outcome regardless of tx age.

## Acceptance

- [ ] Fixture tx: balance delta matches on-chain outcome.
- [ ] Token-2022 transfer with transfer-fee: warning emitted.
- [ ] ALT-using tx: resolved writable accounts passed to
      `simulateTransaction`.
- [ ] Timeout path emits info annotation, Approve enabled.
- [ ] Cache hit within 30 s.

## Out of scope

- Rendering simulation in sheets (Task 16).
- Broadcast preflight cache read (Task 20).
- Token-2022 per-extension annotations (Task 14).

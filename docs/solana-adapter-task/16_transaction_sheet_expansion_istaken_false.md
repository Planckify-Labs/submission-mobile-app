# Task 16 — `SolanaTransactionSheet` — decoded + simulation + compute budget + fee payer

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.3, §4.6, §10.4 inv 6/7/23.

## Why this matters

This is the flagship sheet — every signing dApp that isn't SIWS or
batch ends here. Today it renders raw base64; with Tasks 10–14
feeding it simulation + decoded + extension data, it becomes a
full-fidelity "what will this transaction do" view with fee-payer
awareness, compute-budget display, and danger banners for known
footguns.

## Scope

- `components/dapps-browser/approvals/SolanaTransactionSheet.tsx` —
  rewrite:
  - **Top row:** origin, cluster pill, wallet, tx version (`legacy
    | v0`), approximate size in bytes.
  - **Simulation summary** (from `payload.simulation`):
    - Balance delta as `±X.XXXX SOL` for every writable account the
      signing wallet owns (red for outflow ≥ threshold per inv 6).
    - Token deltas — one row per mint, with Token-2022 tag, fee
      deduction shown explicitly when `transferFee` extension
      present.
    - `unitsConsumed` vs declared limit; warn if exceeded (§4.6).
  - **Fee payer row** — from decoded tx message index 0. If ≠ signing
    wallet: "Fees paid by {fp}" label, skip SOL-fee warning. If fee
    payer has no SOL at simulation time: `warn` annotation
    (pre-approved failed-tx heads-up).
  - **Compute budget** block (§4.6):
    - Compute unit limit (dApp-supplied).
    - Compute unit price (micro-lamports/CU).
    - Estimated priority fee in SOL.
    - Network p90 comparison from `rpc.getRecentPrioritizationFees()`.
    - If dApp omitted both: `info: "No priority fee — may drop
      during congestion"`. Do NOT inject our own floor.
  - **Decoded instructions** (from `payload.decoded`):
    - Known programs render human-readable summaries ("Transfer 1.23
      SOL to …", "Approve 100 USDC delegate to …").
    - Unknown programs per invariant 23: `"Unknown program
      {programId} — N bytes of data"` with Show raw expander.
  - **`<RiskBanner>`** surfaces every `SolanaSimulationWarning` from
    the inspector output (Tasks 11, 13, 14), styled by severity
    (info / warn / danger).
- `SolanaAdapter.executeApproval` — `ApprovalKind="signTransaction"`
  or `"sendTransaction"` branch:
  - `sign-only` → `kit.signTransaction(signer, tx)` → returns bytes
    as `Uint8Array`.
  - `sign-and-send` → broadcast via Task 20 state machine → returns
    `{ signature: Uint8Array }` (raw bytes, not base58 per §10.1).
- `bridge/renderers.ts` — register for `(kind ∈ {signTransaction,
  sendTransaction}, namespace: "solana")`.

## Rules (non-negotiable)

- **Every simulation warning surfaces visually.** Invariant 6 —
  writable-account drain detection is not optional.
- **Signature returned to WebView is `Uint8Array`, not base58
  string.** Invariant 13. The injected shim converts if dApp calls
  the legacy `window.solana` path.
- **No auto-injected priority fee.** Invariant §4.6: Phantom's
  auto-inject breaks signature determinism. We annotate "no priority
  fee", do not rewrite.
- **Signing wallet must be a required signer.** Task 20 / kit
  enforces; the sheet assumes this and shows "wallet is co-signer"
  when fee payer ≠ wallet.

## Acceptance

- [ ] Jupiter devnet swap: balance delta + token delta + ALT-resolved
      accounts displayed.
- [ ] Token-2022 mint fixture: extension warnings visible.
- [ ] Raw base64 never shown on the summary row — only in an expander.
- [ ] Simulation failure fixture: decoded error name from Task 13
      surfaces (not raw `{Custom: 1}`).
- [ ] Snapshot tests for happy path, fee-payer-not-wallet, unknown
      program, compute-unit-over-limit.

## Out of scope

- SignAll (Task 17).
- Broadcast state machine details (Task 20).
- Durable nonce / co-signer flows (Tasks 23, 24).

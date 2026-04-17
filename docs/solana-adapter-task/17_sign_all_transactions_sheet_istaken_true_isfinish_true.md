# Task 17 — `SolanaSignAllTransactionsSheet` + variadic routing

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.2c, §4.11, §10.1.

## Why this matters

`solana:signTransaction` is variadic at the protocol level. Magic
Eden listings + Tensor bids + pump.fun launches all call it with N
transactions. There's no separate `signAllTransactions` feature on
the wire — but internally we need a distinct sheet and
`ApprovalKind` so the user sees all N txs before a single
approve/reject decision. Cap N ≤ 20.

## Scope

- `components/dapps-browser/approvals/SolanaSignAllTransactionsSheet.tsx`:
  - Header: origin, cluster, wallet, "{N} transactions".
  - Collapsible per-tx cards, each with the same shape as
    `SolanaTransactionSheet` (decoded + simulation + compute
    budget + fee payer + risk banner).
  - Global approve / reject — no partial-approve (Wallet Standard
    contract: variadic call succeeds or fails atomically).
  - "Expand all" / "Collapse all" toggle.
  - Global risk rolls up the max severity of any inner tx.
- `SolanaAdapter.handleRequest`:
  - When `solana:signTransaction` is called with N > 1 inputs →
    `makeSignAllIntent` → `ApprovalKind="signAllTransactions"`.
  - N > 20 → `ChainResult.error(-32602 "too many transactions
    (max 20)")`.
  - N == 1 → `ApprovalKind="signTransaction"` (Task 04 path).
  - N == 0 → `ChainResult.error(-32602 "no transactions provided")`.
- `SolanaAdapter.executeApproval` — `ApprovalKind="signAllTransactions"`:
  - Signs each tx serially via the same `KeyPairSigner` (TWV-2026-070
    dwell — one signer instance, N signatures).
  - Returns `readonly { signedTransaction: Uint8Array }[]` in input
    order.
- `services/chains/solana/signer.ts::installSolanaSigner` — extend
  with `handleSignAll(payloads[])` calling `kit.signTransactions`
  variadic.
- **Per-tx simulation** — the inspector (Task 11) runs N times, one
  per tx. Inspector pipeline handles this by iterating
  `payload.transactions` inside the patch.
- `bridge/renderers.ts` — register for `(kind:
  "signAllTransactions", namespace: "solana")`.

## Rules (non-negotiable)

- **Cap at 20.** Jupiter bundles up to 5; MagicEden up to 12; 20 is
  headroom. Sheet UX degrades past that; reject cleanly at
  `-32602`.
- **Atomic approve.** Variadic sign is all-or-nothing — no
  partial-approve surface. Dapps depend on this for listings /
  launches.
- **Single signer instance across N signatures.** Invariant
  TWV-2026-070 — one dwell point, not N.
- **Order preserved.** Output array indices match input.

## Acceptance

- [ ] pump.fun launch fixture (N=3) — sheet renders 3 expandable
      cards.
- [ ] N=21 → `-32602`.
- [ ] N=0 → `-32602`.
- [ ] `window.solana.signAllTransactions(txs)` legacy path maps
      through to the same sheet (verified via shim unit test).
- [ ] Output array length matches input length.

## Out of scope

- Partial / multi-signer flow (Task 24 — different semantic).
- Broadcast (Task 20; `signAllTransactions` is sign-only).

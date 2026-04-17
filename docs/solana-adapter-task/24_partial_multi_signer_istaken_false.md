# Task 24 — Partial / multi-signer flow

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.11, §6 Phase 1c.

## Why this matters

pump.fun, Jupiter Hybrid, Drift Vaults all use "fee payer elsewhere,
user is co-signer" transactions. The fee payer (a vault PDA or a
third-party relayer) adds its signature off-session; the user's
signature is added inside our wallet; the combined tx is then
broadcast by the dApp. Without this, every co-signer flow fails:
either we reject thinking we're not the fee payer, or we broadcast
an incomplete tx.

## Scope

- `SolanaAdapter.executeApproval` for `ApprovalKind="signTransaction"`:
  - If tx's `message.staticAccountKeys[0]` (fee payer) ≠
    `activeWallet.address` AND active wallet is in `staticAccountKeys`
    at a non-zero index: **partial-sign path**.
  - If active wallet is NOT in `staticAccountKeys` at all: reject
    `-32602 "wallet is not a required signer"` per §4.11 edge 1.
  - If all signature slots already filled: return unchanged + `info:
    "Transaction was already fully signed"` per §4.11 edge 2.
- **Partial-sign path:**
  - Call `kit.signTransaction([signer], tx)` which merges exactly one
    signature without mutating others.
  - Return the resulting base64 wire via `signedTransaction: Uint8Array`.
  - Never broadcast — the dApp finalises.
- `SolanaTransactionSheet` (Task 16):
  - Show "Signing as co-signer; {feePayer} must finalize" row.
  - Show which signature slots are still empty after our sign.
- `simulate.ts` (Task 11) — simulation continues to work; the
  simulator accepts unsigned / partially-signed txs when
  `sigVerify: false`.
- **`signAndSendTransaction` + partial-signer** — if the fee payer is
  not our wallet but dApp called `signAndSendTransaction`: reject
  `-32602 "cannot broadcast partially-signed transaction; use
  signTransaction"`. Forces the dApp to use the correct method.

## Rules (non-negotiable)

- **Zero-slot preservation.** `kit.signTransaction` merges without
  mutating other slots; verified by assertion after sign.
- **Wallet must be a required signer.** §4.11 edge 1. Never produce
  a signature dApps can't use.
- **Never silently broadcast a partial tx.** Reject the
  `signAndSendTransaction` variant cleanly.
- **Never add signatures for another required signer.** TWV-2026-070
  bans that — we have only our own keypair.

## Acceptance

- [ ] Fixture: fee-payer is PDA, active wallet is co-signer →
      partial-sign path, output has active wallet's signature only.
- [ ] Fixture: active wallet not in signer set → `-32602` before
      sheet.
- [ ] Fixture: fully-signed tx → returns unchanged with info banner.
- [ ] `signAndSendTransaction` on partial-signer tx → `-32602`.
- [ ] Drift Vaults deposit end-to-end works.

## Out of scope

- Fee-payer UX with no balance (already covered in Task 16 simulation
  warning).

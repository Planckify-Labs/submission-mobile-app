# Task 11 — `transferService.ts` — `getSolanaBalance` + `buildAndSendSolTransfer`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §7.6.

## Why this matters

`SolanaWalletKit` (Task 12) needs small, testable primitives for "fetch
native balance" and "build + sign + submit a SOL transfer". Keeping
these out of the kit lets us unit-test the transaction-building flow
without a registry or a `TWallet`.

## Scope

- `services/chains/solana/transferService.ts`:
  - `getSolanaBalance(rpc: SolanaRpc, address: string): Promise<bigint>`
    per §7.6 — `rpc.getBalance(address).send()` → `BigInt(value)`.
  - `getSolanaRentExemption(rpc: SolanaRpc, size: number): Promise<bigint>`
    — convenience for future F6 work; in this task returns the minimum
    balance for a 0-byte account (used by the estimator's fee reserve).
  - `buildAndSendSolTransfer({ rpc, rpcSubs?, signer, to, lamports })`
    per §7.6:
    - `getLatestBlockhash`
    - `pipe(createTransactionMessage({ version: 0 }), feePayerSigner,
      lifetime, appendInstruction(getTransferSolInstruction(…)))`
    - `signTransactionMessageWithSigners(message)`
    - If `rpcSubs` provided → `sendAndConfirmTransactionFactory` at
      `confirmed` commitment.
    - Else → `rpc.sendTransaction(getBase64EncodedWireTransaction(tx)).send()`.
    - Return `getSignatureFromTransaction(tx)`.
- `services/chains/solana/transferService.test.ts` — mock
  `rpc.getLatestBlockhash()` + `rpc.sendTransaction()`; assert:
  - Fee payer equals signer address.
  - Signature length is 64 bytes.
  - Transfer instruction lamports round-trip.
  - Returned value equals `getSignatureFromTransaction(tx)` (stable
    across signer invocations for a given blockhash).

## Rules (non-negotiable)

- **Public-RPC-friendly default.** When `rpcSubs` is undefined, the
  fallback `sendTransaction` path is used — no WebSocket subscription
  required. Users on the default Solana public RPCs should not need
  extra config.
- **No `@solana/web3.js`.** This is a `@solana/kit`-only module (the
  spec's Anza functional v2 stack).
- **No `Math.random`.** The kit handles entropy via the polyfill.
- **Bigint lamports throughout.** Never convert to `number` in the hot
  path.

## Acceptance

- [ ] `services/chains/solana/transferService.ts` exports the three
      functions.
- [ ] Unit tests pass with mocked RPC.
- [ ] A devnet smoke test (manual): passing a real signer + recipient
      produces a signature observable on Solana Explorer devnet within
      10s.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- SPL transfers (future F6).
- Kit wrapper that consumes this (Task 12).

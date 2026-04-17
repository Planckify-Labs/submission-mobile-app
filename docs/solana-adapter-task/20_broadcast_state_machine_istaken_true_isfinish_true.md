# Task 20 — `broadcast.ts` — preflight + polling confirmation + retry

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.10, §10.4 inv 19/21.

## Why this matters

`installSolanaSigner` today either uses `sendAndConfirmTransactionFactory`
(requires WS subs we don't ship) or fires one `sendTransaction` and
forgets — both broken in production. This task replaces both with a
deterministic polling state machine that honors the dApp's
`options.commitment / preflightCommitment / maxRetries` contract,
re-broadcasts the same signed bytes on blockhash refresh (never
re-signs — invariant 19), and reuses the simulation cache as
preflight (invariant 21).

## Scope

- `services/chains/solana/broadcast.ts::broadcastWithConfirmation(
  signedTxBase64, opts, rpc)`:
  1. **Preflight.** If `skipPreflight=false`:
     - Try reusing simulation cache (Task 11) keyed by
       `sha256(signedTxBase64)`; if present and same
       `preflightCommitment`, use it.
     - Otherwise `simulateTransaction(wire, { commitment:
       preflightCommitment })`.
     - Error → reject `-32603 "preflight failed: <decoded>"` (Task
       13 for decode).
  2. **Capture deadline.** For recent-blockhash txs: node-supplied
     `lastValidBlockHeight` from the blockhash; default ~150 slots.
     For durable-nonce txs: no deadline (nonce is the lifetime).
  3. **Broadcast.** `rpc.sendTransaction(wire, { skipPreflight,
     maxRetries: 0, encoding: "base64" })`. `maxRetries: 0` disables
     node-side retry; we control retries client-side.
  4. **Confirmation poll loop** (every 1500 ms):
     - `getSignatureStatuses([sig], { searchTransactionHistory:
       false })`.
     - `err !== null` → reject with decoded error.
     - `confirmationStatus >= opts.commitment` → resolve with
       signature bytes.
     - `currentBlockHeight > lastValidBlockHeight` (recent blockhash
       path) → re-broadcast same wire; up to 3 resubmits; then
       reject `-32603 "blockhash expired before confirmation"`.
     - Durable-nonce path → resubmit indefinitely until per-intent
       timeout (default 90 s; configurable up to 10 min for
       offline-signing flows — §8 Q6).
  5. **`maxRetries` budget.** Each explicit dApp-requested retry
     costs one.
  6. **`minContextSlot`** passed through to `simulateTransaction`
     and `getSignatureStatuses`.
- `services/chains/solana/signer.ts::installSolanaSigner` —
  `handleSignAndSendTransaction` delegates to `broadcastWithConfirmation`
  when `rpcSubscriptions` is undefined (default P1). When set, falls
  through to `sendAndConfirmTransactionFactory`.
- `broadcast.test.ts` — simulated RPC with fake blockhash expiry,
  decoded-error path, preflight-cache hit.

## Rules (non-negotiable)

- **Never re-sign on blockhash expiry.** Invariant 19 — always
  re-broadcast the same signature. Producing a different signature
  breaks audit / receipt pages. Reject `-32603` on expiry.
- **Preflight cache keyed by signature hash.** Invariant 21 —
  signature change invalidates. Cannot answer "simulated OK" for a
  tx we didn't simulate.
- **Node-side retries disabled** (`maxRetries: 0`). Client owns
  retry logic.
- **`minContextSlot` honored.** Prevents stale-replica reads.
- **`preflightCommitment ≠ commitment` respected.** Lazy default
  only when dApp omits.

## Acceptance

- [ ] Fixture tx: happy path resolves with signature bytes at
      declared commitment.
- [ ] Simulated blockhash expiry: rebroadcasts 3x then rejects
      `-32603 blockhash expired`.
- [ ] Simulated preflight error: `-32603` with decoded message from
      Task 13.
- [ ] `maxRetries: 1` + failed first attempt → one retry then reject.
- [ ] Same signature returned across retries (invariant 19).
- [ ] WS path still used when `EXPO_PUBLIC_SOLANA_*_RPC_SUBSCRIPTIONS`
      env set (smoke test).

## Out of scope

- UI "keep waiting" button for durable-nonce (§8 Q6 — future UX).
- WebSocket confirmation (env-opt-in, no feature change).

# Task 33 — Third-party dApp smoke test matrix

**Status:** Not taken
**Owner:** Mobile (mobile-app), QA partnership
**Spec reference:** `solana-adapter-spec.md` §7, §10.5.

## Why this matters

Specs pass; dApps break. Real-world production compliance is
verified only by hitting every major Solana dApp and completing a
full round-trip. The §10.5 list is the GA gate — every checkbox
must be green, with a screenshot per approval, before ship.

## Scope

Walk through each row in §10.5 on a fresh device (iOS + Android).
For each, record:
- Screenshot of each approval sheet (connect, sign, confirm).
- Transaction signature on-chain.
- `[takumi-diagnostic]` logs during the session.
- Timing (how long from dApp prompt to approval-complete).

**The matrix (from §10.5):**

- [ ] **Phantom's Wallet Standard demo** — connect, SIWS, signMessage,
      signTransaction (legacy + v0), signAndSendTransaction.
- [ ] **Jupiter** (mainnet) — route + swap with ALTs; route + swap
      with priority fee; route cancellation.
- [ ] **Magic Eden** — connect, sign a listing (SIWS +
      signAllTransactions), buy NFT (signAndSendTransaction).
- [ ] **Tensor** — connect, signMessage login, place bid
      (signAllTransactions).
- [ ] **Drift** — SIWS login, deposit, open position (partial-signer
      + priority fee).
- [ ] **Marinade** — stake SOL (legacy tx), unstake (v0 tx).
- [ ] **pump.fun** — buy + sell loop on a live token (sign-and-send
      w/ compute budget); verify Token-2022 mints surface extensions.
- [ ] **Solana Faucet** (devnet) — airdrop flow tests cluster-switch
      UX.
- [ ] **Token-2022 transfer-fee mint** (PYUSD or equivalent) —
      extension warning visible.
- [ ] **Backpack durable-nonce demo** — offline-signing round-trip.
- [ ] **Anchor-app demo using `window.solana` directly** (pump-based
      launch page) — no regressions on the shim path.

**Plus §7 layered tests** (reject paths, origin pinning mid-flight,
versioned tx fixtures).

## Deliverables

- A markdown report `docs/design-notes/solana-adapter-smoke-YYYY-MM-DD.md`
  with one section per dApp: steps, screenshots, tx signature,
  pass/fail.
- Any failure blocks GA — file a bug referencing the exact §10
  invariant violated.

## Rules (non-negotiable)

- **Every row green before sign-off.** No "working on staging" — the
  production build against production RPC (via proxy) is what
  ships.
- **Both iOS and Android** — each platform has distinct WebView
  behaviours and the matrix runs on both.
- **Reject paths tested too.** For each dApp, reject at least one
  approval; dApp must observe `4001` cleanly.

## Acceptance

- [ ] Report written, every row green, all screenshots embedded.
- [ ] Any failure linked to an open bug referencing §10.
- [ ] Sign-off from QA + product before enabling GA flag.

## Out of scope

- Platform-transport dApps (MWA, WalletConnect) — out of scope per §9.

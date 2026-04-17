# Task 33 — Third-party smoke matrix (preparation scaffold)

**Status:** Blocked on real-device QA session (iOS + Android hardware).
**Owner:** Mobile + QA.
**Prep work completed:** code paths landed in tasks 01–22, 25, 30–32.

This file captures the smoke-matrix fixtures so the QA engineer running the
physical session has a concrete checklist. Actual sign-off (screenshots +
on-chain signatures) happens live and is pinned to this file.

## Matrix (§10.5)

- [ ] **Phantom Wallet Standard demo** — `https://demo.phantom.app`
  - Connect via TakumiAI shows up in the picker without a manual adapter.
  - `signIn` surfaces `SolanaSignInSheet`, domain matches, banner clean.
  - `signMessage` renders utf-8; copy-to-clipboard emits base64 only.
  - `signTransaction` single + batch render decoded instructions.
- [ ] **Jupiter** (mainnet) — route + swap with ALTs.
  - Priority fee row present in the tx sheet.
  - Cluster pill shows `Mainnet`.
- [ ] **Magic Eden** — connect, list NFT, buy NFT.
  - Sign-all flow (listing) surfaces `SolanaSignAllTransactionsSheet` with
    expand/collapse per tx.
- [ ] **Tensor** — signMessage login, place bid.
- [ ] **Drift** — SIWS login, deposit, open position.
  - Third-party fee payer row renders when applicable.
- [ ] **Marinade** — stake (legacy) + unstake (v0).
- [ ] **pump.fun** — buy + sell on a new launch.
  - Compute budget row populated.
- [ ] **Devnet faucet** — exercises `takumi:switchCluster` end-to-end.
- [ ] **Token-2022 transfer-fee mint** — extension row surfaces with `warn`
  severity.

## Capture checklist per row

- Screenshot of each approval sheet.
- On-chain signature reference (explorer link).
- `[takumi-diagnostic]` console log sample.
- Timing (dApp prompt → approval-complete).

## What the code-side preparation covers

- The Wallet Standard wallet object + handshake (task 03) is verified shape-good
  by the `__wallet-standard-lint.ts` predicate (24 assertions, all green).
- Error codes (§10.3) verified by `SolanaAdapter.errorCodes.test.ts`.
- Redaction (§10.4 inv 11) verified by `redact.test.ts`.
- SIWS message builder (§4.8) verified by `siws.test.ts` Phantom-reference
  vectors.

## What the live session verifies that code tests can't

- Real dApp picker visibility under `@solana/wallet-adapter-wallet-standard`.
- Signature acceptance by each relying party (verifies we produce bytes the
  dApp's server can verify).
- UX timing / readability under real device pixel density.
- Real RPC behaviour under production rate limits.

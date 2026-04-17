# Task 32 — `__wallet-standard-lint.ts` dev-only CI predicate

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §10.6.

## Why this matters

§10.6 is a reviewer checklist with roughly two dozen rows. A stray
refactor that changes `publicKey: Uint8Array` to a base58 string
doesn't break any test today — it just makes the wallet silently
invisible to real dApps. This task ships a lint that loads
`@wallet-standard/app` + `@solana/wallet-adapter-wallet-standard` in
a jsdom sandbox and runs every predicate those libraries apply. Any
shape regression fails CI.

## Scope

- `services/chains/solana/__wallet-standard-lint.ts` — dev-only (not
  bundled into production; Metro/Jest path):
  - Loads the injected script output from Task 03 into a jsdom global.
  - Simulates the `wallet-standard:register-wallet` handshake.
  - Runs every predicate `@solana/wallet-adapter-wallet-standard`
    applies when deciding if a wallet is usable:
    - `wallet.version === "1.0.0"` literal.
    - `wallet.icon` matches `data:image/(svg\+xml|webp|png|gif);base64,…`.
    - `wallet.chains` ⊇ `[mainnet, devnet, testnet]` short forms.
    - `wallet.accounts` is `[]` pre-connect.
    - Every feature key has the right `version` + function signatures.
    - `supportedTransactionVersions` is a literal (use
      `Object.getOwnPropertyDescriptor` to assert not a getter).
    - `WalletAccount.publicKey` is a `Uint8Array(32)`.
    - `WalletAccount.features` ⊇ required set.
- CI integration — new `pnpm run test:wallet-standard-lint` hooked
  into the default `test` command.
- Includes all 24 bullets from §10.6 "Object shape", "Account shape",
  "Feature surface", "Handshake", "Behavior".

## Rules (non-negotiable)

- **Lint is dev-only.** Do not include jsdom or adapter packages in
  the production bundle. Gated behind `if (__DEV__)` checks or
  Jest-only configuration.
- **Lint runs in CI.** A regression in the injected script shape
  fails the PR.
- **Every bullet from §10.6 has a predicate.** Review the doc and
  add a matching assert; no silent omissions.

## Acceptance

- [ ] Lint passes against the current injected script.
- [ ] Deliberately flipping `publicKey` to base58 fails the lint.
- [ ] Deliberately making `supportedTransactionVersions` a getter
      fails the lint.
- [ ] CI step green on a clean branch.

## Out of scope

- Third-party smoke matrix (Task 33) — complementary but distinct.

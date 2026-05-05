# Task 10 — Extend `deriveWalletsFromMnemonic` namespaces to `["eip155","solana","sui"]`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §8.3, §2.7.

## Why this matters

The create-new flow today auto-mints two wallets (EVM + Solana) from
one mnemonic via `deriveWalletsFromMnemonic` in
`services/walletKit/deriveAll.ts`. The helper itself iterates over the
requested namespaces — adding Sui means changing the namespace list at
the call site, not the helper. The helper already has a partial-success
path (a Sui derivation failure won't poison EVM/Solana), and the file
already carries a `// future Sui kit` comment marking the intent.

## Scope

- `services/walletKit/bootstrap.ts` (or wherever the namespace list
  lives — verify with `grep -rn '"eip155".*"solana"' services/walletKit/`):
  - Extend the namespace list passed into `deriveWalletsFromMnemonic`
    from `["eip155", "solana"]` to `["eip155", "solana", "sui"]`.
  - Confirm partial-success semantics: a thrown derivation in any one
    namespace returns the others; never throws as a whole.
- `services/walletKit/deriveAll.test.ts` — extend:
  - `deriveWalletsFromMnemonic(testMnemonic, ["eip155","solana","sui"])`
    returns three wallets sharing `seedPhrase`.
  - Each wallet's `address` matches its respective golden vector
    (Task 03 for Sui).
  - Stub the Sui kit to throw and assert EVM + Solana still return.

## Rules (non-negotiable)

- **No new branching in `deriveAll.ts` itself.** The helper is already
  namespace-agnostic — driving by the input list is the contract.
- **Order matches the kit registry** (EVM, Solana, Sui). Determines
  the order users see in the wallet list immediately after onboarding.
- **Active wallet selection unchanged.** The first-derived wallet
  (EVM) remains active by default. Switching to Sui is an explicit
  user action.
- **No backward-compat shim.** Old wallets that exist before this PR
  do not get a Sui wallet auto-minted. Add-via-sheet flow is the path
  for them.

## Acceptance

- [ ] Bootstrap passes `["eip155","solana","sui"]` to
      `deriveWalletsFromMnemonic`.
- [ ] Three-wallet test passes.
- [ ] Partial-success test passes (Sui derive failure doesn't poison
      EVM / Solana).
- [ ] On a fresh install + create-new flow, the wallet list shows
      three rows in order: EVM, Solana, Sui.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Import-existing-mnemonic flow updates — `ImportSeedPhraseSheet`
  already lets users pick which namespaces to derive; no code change
  needed there once the Sui kit is registered (Task 09).
- Add-Sui-wallet-to-existing-mnemonic UX — already covered by the
  Add Wallet sheet (Solana rollout).

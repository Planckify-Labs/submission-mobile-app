# Task 24 — `ImportSeedPhraseSheet` — multi-chain paste

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §14.6, §14.7.

## Why this matters

Users arriving with an existing BIP-39 mnemonic should be able to land
on every registered chain at once — no forcing them through two import
flows for EVM and Solana. A single mnemonic derives cleanly to both via
BIP-44 (EVM) and SLIP-0010 (Solana), so this sheet mirrors Task 23's
multi-chain derivation but skips generation.

## Scope

- `components/wallet/create/ImportSeedPhraseSheet.tsx`, three-step
  flow per §14.6:
  1. **Textarea** — 12 or 24 words, BIP-39 validate on blur via
     `@scure/bip39::validateMnemonic(input.trim(), wordlist)` (or
     `EvmWalletKit.validateMnemonic` / `SolanaWalletKit.validateMnemonic`
     — both use the same BIP-39 source).
  2. **`NamespacePicker` multi-select** — defaults all checked; user
     can uncheck chains they don't want on this device.
  3. **Confirm** → `deriveWalletsFromMnemonic(mnemonic, selected)` →
     `useWallet.addWallets(wallets)` (batch, single save).
- Error states:
  - Invalid checksum → inline "This doesn't look like a valid BIP-39
    phrase."
  - Zero chains selected → confirm button disabled.
- Duplicate-wallet handling: if the derived wallet for a given
  namespace already exists in the bundle, show a non-fatal banner and
  skip that row (don't block the import of the other chains).
- Unit test: paste + pick both chains → produces EVM + Solana wallets
  with matching `seedPhrase`.

## Rules (non-negotiable)

- **BIP-39 check runs before derivation.** Derivation libs can throw
  on invalid input — validating first gives a user-friendly error.
- **Default all chains checked.** Matches Task 23's default; users
  expect "Import my seed" to get them to the same place on every
  chain.
- **TWV-2026-057 dwell discipline.** Mnemonic is held only while the
  sheet is open; on `onWalletAdded` the sheet closes and local refs
  drop. Never logged.
- **Trim + normalise on input.** Accept mixed-case, extra whitespace;
  normalise before validation.

## Acceptance

- [ ] Paste a valid mnemonic, keep both chains checked → both wallets
      land; both have `seedPhrase` equal to the pasted mnemonic.
- [ ] Paste an invalid mnemonic → clear inline error, confirm disabled.
- [ ] Batch add triggers one biometric prompt.
- [ ] `pnpm check:syntax` passes; snapshot + interaction tests.

## Out of scope

- Private-key import (Task 25).
- Derivation-path override (future).
- Multi-account indexing beyond index 0 (out-of-scope per §14.10).

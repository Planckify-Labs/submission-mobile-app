# Task 23 — `CreateWalletSheet` — generate → verify-words → multi-chain derive

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §14.6, §14.2, §14.9.

## Why this matters

The verify-words experience from the old `components/login/WalletSetup.tsx`
is the best part of today's setup flow — we preserve it, relocate it
into the sheet, and extend it with a namespace multi-select so one
mnemonic produces a wallet per chosen chain. Deleting the standalone
component (Task 20) forces reuse.

## Scope

- `components/wallet/create/CreateWalletSheet.tsx`, four-step flow per
  §14.6:
  1. **Generate mnemonic** — `generateWalletMnemonic(128)` displayed
     in the reveal view with copy disabled and screenshot blur (carry
     over the `WalletSetup.tsx` implementation).
  2. **Verify words** — the existing shuffle + select-in-order UX from
     `WalletSetup.tsx`. Block advancement until correct.
  3. **`NamespacePicker` multi-select** — defaults all checked.
     Displays cards from `walletKitRegistry.getAll()`.
  4. **Confirm** → `deriveWalletsFromMnemonic(mnemonic, selected, defaultWalletNameFor)`
     → `useWallet.addWallets(wallets)` (single save round-trip) →
     `onWalletAdded(wallets)`.
- Add `useWallet.addWallets(wallets: TWallet[])` — loops the existing
  `addWallet` logic, skipping duplicate-address checks only across the
  batch. One biometric prompt, one `saveWalletsToStorage`.
- Delete `components/login/WalletSetup.tsx` in this task (if not
  already removed by Task 20). Make sure the copy/screenshot-blur
  behavior is preserved verbatim.
- Unit test: multi-chain path produces the expected wallet count and
  `onWalletAdded` receives a `TWallet[]` whose namespaces match the
  selection.

## Rules (non-negotiable)

- **CSPRNG-only generation.** `generateWalletMnemonic` is the only
  entropy source (TWV-2026-002).
- **Verify step blocks advancement.** Users cannot skip the word-check
  via a swipe-down dismiss and come back mid-flow — dismiss resets.
- **Default all chains checked.** A user who doesn't understand the
  picker still ends up with a working setup on every registered kit.
- **TWV-2026-057 dwell discipline.** The sheet never holds a
  decrypted key longer than the synchronous `kit.createWalletFromMnemonic`
  call; the resulting `TWallet` is immediately handed to
  `useWallet.addWallets` and local references drop.

## Acceptance

- [ ] Fresh flow produces N wallets matching the user's namespace
      multi-select; all share `seedPhrase`.
- [ ] Verify-words step mirrors legacy `WalletSetup.tsx` UX.
- [ ] One biometric prompt per multi-wallet confirm (TWV-2026-060).
- [ ] `pnpm check:syntax` passes; snapshot + interaction tests.

## Out of scope

- Seed import (Task 24), private-key import (Task 25).
- `wallet.tsx` wiring (Task 26).
- Formal derivation-group UI (F7).

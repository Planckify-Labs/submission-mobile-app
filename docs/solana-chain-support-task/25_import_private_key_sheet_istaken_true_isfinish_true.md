# Task 25 — `ImportPrivateKeySheet` — single-chain with picker

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §14.6.

## Why this matters

Private-key imports are the trickiest: one key, one chain, and crossing
curves would silently mint "a wallet the user doesn't own anywhere
else." This sheet enforces the hard rule — **no cross-chain derivation
from one key** — by making the chain pick explicit, with the paste-
format inference as a soft hint only.

## Scope

- `components/wallet/create/ImportPrivateKeySheet.tsx`, three-step
  flow per §14.6:
  - **Step 1 — Pick chain.** Cards from
    `walletKitRegistry.getAll().filter(k => k.supportsPrivateKeyImport?.() !== false)`.
    If user pastes first (or returns from step 2 after paste),
    `inferNamespaceFromKey` pre-highlights the likely card — but the
    pick is user-confirmed.
  - **Step 2 — Paste key.** Textarea with chain-specific placeholder:
    - EVM → `"0x... (64 hex chars)"`
    - Solana → `"Base58 (88 chars, Phantom export format)"`
    Live validation via `kit.validatePrivateKey(input)`. Error copy is
    chain-specific (e.g. `"This doesn't look like a Solana private
    key — expected 64-byte base58."`).
  - **Step 3 — Name & confirm.** →
    `kit.createWalletFromPrivateKey(pk, name)` → `useWallet.addWallet(wallet)`
    → `onWalletAdded`.
- Footer on every step: "Wrong chain? A seed phrase imports all chains
  at once. **[Import seed phrase instead]**" — opens the parent
  `AddWalletSheet`'s `ImportSeedPhraseSheet` sub-step.
- Unit tests per §14.9:
  - Forcing an EVM key into the Solana path shows the validation
    error.
  - Correct key on correct chain imports successfully.
  - Footer "Import seed phrase instead" navigates into the seed-phrase
    sub-sheet.

## Rules (non-negotiable)

- **No cross-chain derivation.** An EVM hex key must never produce a
  Solana wallet. The validators in Tasks 09 + kit (Task 12) enforce,
  but the UI must also never offer "import on both chains" as a
  toggle.
- **User-confirmed pick.** Inference is advisory; a deliberate pick is
  the only safe signal (a 64-hex string can be an EVM key or a
  coincidence).
- **TWV-2026-057 dwell discipline.** Raw key held only during step 3's
  synchronous kit call; dropped immediately after.
- **Paste-UX niceties.** Trim whitespace, accept optional `0x` prefix
  on EVM, but do **not** silently re-encode.

## Acceptance

- [ ] Solana Phantom-exported key imports on Solana → address matches
      what Phantom shows (§9.3 step 8).
- [ ] EVM 64-hex key imports on Ethereum → unchanged from pre-spec
      behavior.
- [ ] Feeding EVM hex into the Solana path surfaces the chain-specific
      error and does not create a wallet.
- [ ] Footer link navigates to the seed-phrase sub-sheet.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Solflare's JSON-array private-key format (Q3 — Phantom base58 only
  in v2.3).
- Hardware-wallet import (separate docking story).

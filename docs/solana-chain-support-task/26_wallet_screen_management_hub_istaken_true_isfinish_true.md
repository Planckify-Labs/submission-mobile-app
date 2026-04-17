# Task 26 — `wallet.tsx` as management hub + `WalletSwitcherModal` rewire

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §14.4, §14.8.

## Why this matters

`wallet.tsx` is where users already go to see their wallets. Making it
the wallet-management hub — "+" opens `AddWalletSheet`, empty state
nudges the same sheet, `WalletSwitcherModal`'s "Add wallet" uses it
too — consolidates the three current entry points (login card, modal
push, header button) into one flow. Also drops the brittle zero-
wallet redirect to `/login`.

## Scope

- `app/wallet.tsx`:
  - Add state: `const [addWalletSheetVisible, setAddWalletSheetVisible] = useState(false)`.
  - Header "+" button: `onPress={() => setAddWalletSheetVisible(true)}`
    (replaces `router.push("/login")`).
  - Mount `<AddWalletSheet visible onClose onWalletAdded>` at the root
    of the screen tree. `onWalletAdded` closes the sheet;
    `useWallet.addWallet(s)` already sets the new wallet active.
  - Empty-state card (shown when `wallets.length === 0`) per §14.4:
    icon + copy + a primary "Add wallet" button that opens the same
    sheet. This is belt-and-braces — bootstrap (Task 19) should prevent
    ever reaching zero wallets, but the UI protects against edge cases
    (user deletes every wallet).
- `components/wallet/WalletSwitcherModal.tsx`:
  - `onAddWallet` prop now drives `setAddWalletSheetVisible(true)` in
    the parent. Delete any `router.push("/login")` inside the modal.
- `hooks/useWallet.ts`:
  - Delete the effect that runs `router.replace("/login")` when
    wallets go to zero. Rendering handles it inline.
  - Add `addWallets(wallets: TWallet[]): Promise<void>` if not already
    added by Task 23 — batch insert, one `saveWalletsToStorage`, one
    biometric prompt.
- Add a persistent soft banner on `wallet.tsx` per §14.3: "Back up
  your recovery phrase" when the user has an auto-minted mnemonic
  that's not yet verified. Dismiss once the verify-words step is
  passed in settings (outside this spec's scope — leave the banner in
  place; the actual settings flow is a follow-up).

## Rules (non-negotiable)

- **Empty-state must not auto-redirect.** Users in zero-wallet land on
  `wallet.tsx` and see a CTA, not a silent reroute to `/login`.
- **One sheet, three entry points.** "+" button, empty-state CTA, and
  `WalletSwitcherModal.onAddWallet` all open the same sheet instance.
- **Keep logout → `/login`.** Logout flows still push to `/login`;
  this task only removes the zero-wallet redirect.
- **Banner dismiss is local state.** Until the verify-words settings
  flow lands, the banner resets each app launch. Don't persist a
  dismissed flag yet — premature persistence will get in the way of
  the real UX when it ships.

## Acceptance

- [ ] "+" button opens `AddWalletSheet`; no `router.push("/login")`
      remains.
- [ ] `WalletSwitcherModal.onAddWallet` opens the same sheet.
- [ ] Deleting every wallet lands on the empty-state card, not on
      `/login`.
- [ ] After auto-mint bootstrap (Task 19), the soft-backup banner
      renders at the top of `wallet.tsx`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Verify-words settings flow for auto-mint mnemonics — follow-up.
- Formal derivation-group UI (F7).
- Any changes to `deposit.tsx` beyond what Task 15 did.

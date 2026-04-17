# Task 22 — `AddWalletSheet` top-level picker

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §14.5, §14.8.

## Why this matters

`AddWalletSheet` is the single entry point for wallet-management
actions. Today those actions live on the login screen (Task 18 strips
them). After this task, `wallet.tsx` mounts `AddWalletSheet` from the
"+" button, the empty-state CTA, and the `WalletSwitcherModal` — one
modal, three entry paths, internal state swaps between the three sub-
sheets.

## Scope

- `components/wallet/create/AddWalletSheet.tsx`:
  - Props: `{ visible: boolean; onClose: () => void; onWalletAdded: (wallet: TWallet | TWallet[]) => void }`.
  - Top-level body renders three tappable cards per the §14.5 layout:
    - **Create new wallet** — "Generate a fresh multi-chain wallet"
    - **Import seed phrase** — "12 or 24 words"
    - **Import private key** — "One chain, one key"
  - Tapping a card swaps to the corresponding sub-sheet inside the
    same modal (no navigation stack, internal `step` state).
  - Each sub-sheet can navigate back via a top chevron.
  - On success, calls `onWalletAdded` and closes.
- The sub-sheets themselves (Tasks 23–25) are rendered by this sheet,
  each receiving `{ onBack, onWalletAdded }`. Stub them with
  placeholders that show their name + `onBack` button in this task;
  Tasks 23–25 fill in the content.
- Test: rendering each card → tapping → asserts the correct sub-sheet
  id is in the tree.

## Rules (non-negotiable)

- **One modal.** No nested navigators; internal state controls which
  sub-sheet renders.
- **Back preserves state.** Leaving a sub-sheet via back returns to
  the top-level picker cleanly; re-entering starts fresh (sheets are
  unmounted between visits — no leaked input).
- **Close wipes state.** Dismissing the sheet resets `step` to the
  picker. Re-opening never lands mid-flow.
- **No bespoke overlay.** Use whatever bottom-sheet library the repo
  already standardises on (grep the existing approval sheets).

## Acceptance

- [ ] `AddWalletSheet` renders at three call sites (wallet.tsx "+",
      empty-state CTA, `WalletSwitcherModal.onAddWallet`) — Task 26
      wires them.
- [ ] Each card navigates to the correct sub-sheet stub; back chevron
      returns to the picker.
- [ ] Closing and re-opening resets to the picker, never mid-flow.
- [ ] `pnpm check:syntax` passes; snapshot test captures the three
      states.

## Out of scope

- Sub-sheet implementations (Tasks 23–25).
- `wallet.tsx` wiring (Task 26).

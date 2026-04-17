# Task 20 — Delete legacy wallet routes + `WalletSetup.tsx`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §14.2, §14.8.

## Why this matters

Once `AddWalletSheet` (Task 22) and its sub-sheets (Tasks 23–25) mount
from `wallet.tsx`, the separate routes are dead weight. Leaving them in
the repo risks a stray `router.push("/import-seed-phrase")` getting
merged later. Cleanup also drops the expo-router typed-routes entries
for these paths, which is a compile-time guard.

## Scope

Delete:

- `app/wallet-setup.tsx`
- `app/import-seed-phrase.tsx`
- `app/import-private-key.tsx`
- `components/login/WalletSetup.tsx` (folded into `CreateWalletSheet`
  in Task 23)

Grep-and-replace per §14.8 migration checklist:

- `router.push("/wallet-setup")` → remove or convert to
  `setAddWalletSheetVisible(true)` depending on context.
- `router.push("/import-seed-phrase")` / `router.push("/import-private-key")`
  → delete surrounding UI; these callers already lost their buttons in
  Task 18.
- `router.replace("/login")` inside `useWallet`'s zero-wallet effect
  → delete the effect; rendering now handles zero-wallet inline via
  Task 26's empty state.
- `import WalletSetup from "@/components/login/WalletSetup"` → delete
  the import; logic lives inside `CreateWalletSheet`.

## Rules (non-negotiable)

- **Order this task after Tasks 22–25** have landed — the replacement
  surfaces must exist before the routes are removed, otherwise users
  hit a dead end.
- **Typed routes regen.** Restart the dev server so `expo-router`
  rebuilds its typed-routes union; expect compiler errors anywhere the
  old routes still linger.
- **No silent redirect replacements.** Every removed `router.push`
  must have a clear replacement (sheet open or UI removal) — do not
  leave stranded `onPress={() => {}}` handlers.
- **Preserve login routing from logout.** `router.push("/login")` from
  logout flows stays valid. Only wallet-management pushes change.

## Acceptance

- [ ] The three `app/*.tsx` files and `components/login/WalletSetup.tsx`
      are deleted in this commit.
- [ ] `pnpm check:syntax` passes with typed-routes regenerated.
- [ ] Grep confirms zero references to the deleted routes /
      component.
- [ ] Manual test: logout → login flow still works; wallet.tsx "+"
      opens the sheet.

## Out of scope

- Building the replacement sheets (Tasks 22–25).
- Management-hub wiring (Task 26).

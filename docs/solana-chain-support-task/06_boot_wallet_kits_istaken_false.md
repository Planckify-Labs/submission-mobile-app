# Task 06 — `bootWalletKits()` + registration in `app/_layout.tsx`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §4.5, §6.1, §6.2.

## Why this matters

The `walletKitRegistry` is a lazy singleton — nothing is registered
until something calls `register()`. Kit-dispatched screens (Tasks
14–16) and the dApp-bridge signer (Task 17) depend on a populated
registry before they run. Boot-time registration, colocated with
`pollyfills.ts`, guarantees the registry is ready before any
wallet-touching screen mounts.

## Scope

- `services/walletKit/boot.ts`:
  ```ts
  export function bootWalletKits(): void {
    walletKitRegistry.register(createEvmWalletKit());
    // Solana registers here once Task 12 lands.
  }
  ```
  Idempotent — calling twice must not double-register (the registry's
  `register` should overwrite by namespace).
- `app/_layout.tsx`: call `bootWalletKits()` once, **after** the
  `pollyfills.ts` import (§6.2 requirement) and **before** any
  wallet-touching screen mounts. Document the ordering constraint with
  a one-line comment.
- In Task 12 (`SolanaWalletKit`), `bootWalletKits()` is updated to
  register Solana too. This task ships only the EVM call so the scaffold
  exists and Task 12's diff is one line.

## Rules (non-negotiable)

- **Boot runs once per process.** Guard with a module-level `booted`
  flag if needed.
- **Order matters.** Polyfill import → `bootWalletKits()` → any screen.
  Insertion order into the registry is EVM-first, which Task 21's
  `NamespacePicker` relies on for stable card ordering.
- **No conditional registration.** Every kit available in the codebase
  registers unconditionally. A user without a Solana wallet still has
  the kit registered — it's the wallet rows that determine what the UI
  shows, not registry membership.

## Acceptance

- [ ] `services/walletKit/boot.ts` exports `bootWalletKits()`.
- [ ] `app/_layout.tsx` calls `bootWalletKits()` once in the expected
      position.
- [ ] Unit test: `bootWalletKits()` registers at least the EVM kit;
      `walletKitRegistry.has("eip155")` returns `true`.
- [ ] `pnpm check:syntax` passes; app launches without regression on
      iOS + Android dev-client.

## Out of scope

- Solana kit (Task 12 adds the second `register` call).
- Bridge signer wiring (Task 17).

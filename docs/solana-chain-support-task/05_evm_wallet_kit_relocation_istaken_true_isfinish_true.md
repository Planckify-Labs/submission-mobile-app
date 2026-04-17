# Task 05 — `EvmWalletKit` — relocate existing viem paths behind the kit interface

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §4.5, §6.1, §7.6, R4b.

## Why this matters

Before we can refactor screens to call the kit uniformly (Tasks 13–16),
the EVM path needs to live behind the same interface Solana will
implement. This task is a **no-behavior-change relocation** — it wraps
existing `utils/walletUtils.ts`, `utils/clients.ts`, and
`walletService.getAccountForWallet` helpers behind the new shape. Any
behavior drift here silently regresses every EVM user; review discipline
is R4b.

## Scope

- `services/walletKit/evm/EvmWalletKit.ts`: `createEvmWalletKit()`
  factory returning a `WalletKitAdapter` wired to the existing helpers
  per §7.6 skeleton:
  - `validateAddress: isAddress` (viem)
  - `validatePrivateKey: validatePrivateKey` (`utils/walletUtils.ts`)
  - `validateMnemonic: isValidMnemonic` (`utils/walletUtils.ts`)
  - `createWalletFromPrivateKey` / `createWalletFromMnemonic`: thin
    async wrappers around existing sync creators
  - `generateMnemonic: generateWalletMnemonic` (from `walletService`)
  - `getSignerForWallet: (w) => getAccountForWallet(w)`
  - `getNativeBalance`: narrow to `eip155`, `getPublicClient(chain.chain).getBalance`
  - `sendNativeTransfer`: narrow to `eip155`, reconstruct account via
    `getAccountForWallet`, send via `getWalletClient(account, chain.chain).sendTransaction`
  - `estimateMaxTransferable`: `pc.estimateGas` × 1.10 × `gasPrice`
  - `formatNativeAmount` / `parseNativeAmount`: `formatUnits` /
    `parseUnits` against `chain.chain.nativeCurrency.decimals`
  - `truncateAddress`: call the existing `truncateAddress` util
  - `supportsTokenTransfer: () => true`
- `services/walletKit/evm/EvmWalletKit.test.ts`: fixture-based snapshot
  — create from private key, get balance against a mock public client,
  send against a mock wallet client; assert byte-identical results to
  the pre-relocation helpers (R4b guard).

## Rules (non-negotiable)

- **Zero behavior change on EVM.** Every underlying call site must be
  an existing helper — no inlining, no reformatting, no "while we're
  here" cleanup.
- **Narrow to `"eip155"` at entry of each method that takes
  `ChainConfig`.** Throw a clear `"expected evm chain"` if mismatched —
  callers (Task 13's `useWallet`) are responsible for dispatching on
  namespace.
- **No new types exported from this module.** Consumers import
  `WalletKitAdapter` from `services/walletKit/types.ts`.
- **No call-site migration in this task.** `send.tsx` / `wallet.tsx`
  keep their current viem calls until Tasks 14, 15. This task just
  makes the kit *available*.

## Acceptance

- [ ] `services/walletKit/evm/EvmWalletKit.ts` exports
      `createEvmWalletKit()`.
- [ ] Unit test covers: create → validate → get balance → send → format
      round-trip; results match pre-existing helper output (R4b).
- [ ] Grep confirms no edits to `app/send.tsx`, `app/wallet.tsx`,
      `components/wallet/*` in this task's diff.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Boot registration (Task 06).
- Any Solana code (Tasks 07–12).
- Refactoring `send.tsx` / `wallet.tsx` to use the kit (Tasks 14, 15).

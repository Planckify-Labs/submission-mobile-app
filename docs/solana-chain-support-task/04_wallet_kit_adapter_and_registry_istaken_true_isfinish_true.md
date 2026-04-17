# Task 04 — `WalletKitAdapter` interface + `walletKitRegistry`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §4.5, §6.1.

## Why this matters

The dApp-bridge spec docked WebView chain requests behind a `ChainAdapter`
port. First-party wallet operations (create, import, balance, send,
format amount) have no such port yet — today `send.tsx` and friends
reach for viem directly. Introducing the `WalletKitAdapter` interface is
the docking seam that lets Solana (and later Sui / Bitcoin) plug in
without inline `if (namespace === "solana")` branches in every screen.
This task ships **only** the interface + registry. Implementations land
in Tasks 05 (EVM) and 12 (Solana).

## Scope

- `services/walletKit/types.ts`:
  - `NativeTransferArgs` — `{ wallet, to, amount: bigint, chain: ChainConfig }`.
  - `WalletKitAdapter` — full interface per §4.5:
    - `namespace: Namespace`
    - Validation: `validateAddress`, `validatePrivateKey`, `validateMnemonic`.
    - Creation: `createWalletFromPrivateKey`, `createWalletFromMnemonic`,
      `generateMnemonic`.
    - Signer: `getSignerForWallet(w): Promise<unknown | null>` (delegates
      to `walletService` dwell sites; the `unknown` return lets EVM and
      Solana return different shapes).
    - Reads: `getNativeBalance(address, chain)`.
    - Writes: `sendNativeTransfer(args)` returns tx hash / signature as
      `string`.
    - Estimate: `estimateMaxTransferable({ balance, chain, from, to? })`.
    - Display: `formatNativeAmount(raw, chain)`, `parseNativeAmount(human, chain)`,
      `truncateAddress(address, opts?)`.
    - Optional capability flags: `supportsTokenTransfer?`,
      `supportsPrivateKeyImport?`, `displayName?`, `iconUrl?`.
- `services/walletKit/registry.ts`: `WalletKitRegistryImpl` with
  `register`, `get` (throws clearly when missing), `has`, `getAll`
  (insertion-ordered). Export the singleton `walletKitRegistry`.
- `services/walletKit/registry.test.ts`: node-only unit test covering
  `register`, `get`-throws-when-missing, `getAll()` insertion-order.

## Rules (non-negotiable)

- **No React / react-native imports in `services/walletKit/types.ts` or
  `registry.ts`.** These modules must run under a node test harness.
- **No viem imports.** Viem lives inside `services/walletKit/evm/` only.
- **`get(ns)` throws when missing.** Per the spec snippet — returning
  `null` forces every caller to null-check; throwing makes missing-kit
  loud and obvious during development.
- **`getAll()` is insertion-ordered.** Map spec guarantees this — UI
  pickers (Tasks 21, 23, 24, 25) rely on EVM-first / Solana-second
  ordering without explicit sorting.
- **Interface covers the v2.3 surface.** Future chains with different
  shape extend via optional capability methods (R4c mitigation).

## Acceptance

- [ ] `services/walletKit/types.ts` exports `WalletKitAdapter` and
      `NativeTransferArgs`.
- [ ] `services/walletKit/registry.ts` exports `walletKitRegistry`.
- [ ] `services/walletKit/registry.test.ts` passes under `pnpm run test`.
- [ ] Grep confirms no `react`, `react-native`, or `viem` import in
      either file.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `EvmWalletKit` implementation (Task 05).
- `SolanaWalletKit` implementation (Task 12).
- Boot registration (Task 06).

# Task 08 — `SuiWalletKit` implementation

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §4, §4.1.

## Why this matters

This task binds the Sui primitives (Tasks 03–07) behind the
`WalletKitAdapter` interface so screens, onboarding sheets, agent-mode
executors, and the future `SuiAdapter` all dispatch through one seam.
When this lands, `walletKitRegistry.get("sui")` returns a functional
kit and the rest of the feature becomes wire-up.

## Scope

- `services/walletKit/sui/SuiWalletKit.ts`: `createSuiWalletKit()`
  factory per spec §4 pulling together:
  - `validateAddress` → `isValidSuiAddress` (Task 06).
  - `validatePrivateKey` → `isValidSuiPrivateKey` (Task 06).
  - `validateMnemonic` → `validateMnemonic(m.trim(), englishWordlist)`.
  - `createWalletFromPrivateKey` / `createWalletFromMnemonic` →
    Task 06 helpers.
  - `generateMnemonic` → `generateWalletMnemonic` (shared BIP-39 via
    `walletService`).
  - `getSignerForWallet` → `getSuiSignerForWallet` (Task 05).
  - `signAuthMessage` → inline `signPersonalMessage` on the keypair
    (no extra helper file — see spec §3.2 "Pattern note").
  - `getNativeBalance` → `client.getBalance({ owner }).totalBalance`.
  - `getTokenBalance` → `client.getBalance({ owner, coinType })` for
    Coin<T>, plus `getClosedLoopTokenBalance` helper for the
    Closed-Loop branch (sums `0x2::token::Token<T>` `balance` fields).
  - `sendNativeTransfer` → delegates to `buildAndSendSuiTransfer`
    (Task 07).
  - `sendTokenTransfer` → delegates to `buildAndSendSuiCoinTransfer`
    (Task 07).
  - `estimateMaxTransferable` → `balance - MAX_GAS_BUDGET_MIST`
    (named constant `50_000_000n` MIST = 0.05 SUI per spec).
  - `formatNativeAmount` → `(n / 1_000_000_000).toFixed(4) + " SUI"`.
  - `parseNativeAmount` → `BigInt(Math.round(float * 1_000_000_000))`.
  - `truncateAddress` → start/end slice (default 6/4) like EVM kit.
  - `formatConnectChipLabel(payload)` → `Sui · Mainnet` etc.
  - `getChainId` / `formatChainLabel` / `nativeSymbol` → narrow on
    `chain.namespace === "sui"`; return `null` otherwise.
  - `buildTxExplorerUrl` → SuiVision URL with `testnet.` / `devnet.`
    subdomain prefix (spec §11 resolved decision 3).
  - `displayName: "Sui"`.
  - **No `brandColor`.** `ConnectSheet` falls back to
    `DEFAULT_BRAND_COLOR` (spec §11 resolved decision 4).
  - `requireBiometricForConnect: true`.
  - `supportsTokenTransfer: true`, `supportsPrivateKeyImport: true`.
- `services/walletKit/sui/SuiWalletKit.test.ts` — kit round-trip with
  a fixture keypair:
  - `createWalletFromMnemonic` → address matches Task 03 golden vector.
  - `getNativeBalance` against a mocked client returns expected `bigint`.
  - `sendNativeTransfer` against mocked client delegates to
    `buildAndSendSuiTransfer` (spy, assert call shape — regression
    guard against drift from the Solana pattern).
  - `sendTokenTransfer` delegates to `buildAndSendSuiCoinTransfer`
    similarly.
  - `signAuthMessage` byte-for-byte equivalence with
    `Ed25519Keypair.signPersonalMessage` over the same UTF-8 input —
    asserts the kit doesn't accidentally double-wrap intent or drift
    from the SDK helper. (Spec §9 explicit test row.)
  - `estimateMaxTransferable(balance > MAX_GAS_BUDGET_MIST)` →
    `balance - MAX_GAS_BUDGET_MIST`; `(balance < reserve)` → `0n`.
  - `buildTxExplorerUrl` produces the SuiVision URL with the right
    subdomain prefix per network (`mainnet` / `testnet` / `devnet`).

## Rules (non-negotiable)

- **No signing path outside `walletService`.** `sendNativeTransfer` and
  `sendTokenTransfer` resolve the signer via `getSuiSignerForWallet` —
  they do not reconstruct a keypair themselves.
- **No PTB construction inlined in the kit.** Delegate to
  `buildAndSendSuiTransfer` / `buildAndSendSuiCoinTransfer`. Mirrors
  the Solana kit's delegation to `buildAndSendSolTransfer` /
  `buildAndSendSplTransfer`.
- **Narrow, don't cast.** At each method entry, use
  `if (chain.namespace !== "sui") throw …` — never `as any`.
- **`MAX_GAS_BUDGET_MIST` is a named constant** documented as the Sui
  fixed gas-budget upper bound + storage rebate buffer. Magic numbers
  in the kit body are rejected in review.
- **No `brandColor`.** Sui has no project-assigned chip colour. The
  `ConnectSheet` fallback is the contract.
- **No Sui-specific `signX_X` helper file under `walletKit/sui/`.**
  Generic message + transaction signing is inline; pure helper files
  only exist when a primitive is reused outside the kit (e.g. a future
  gasless-payment rail).

## Acceptance

- [ ] `createSuiWalletKit()` exported from
      `services/walletKit/sui/SuiWalletKit.ts`.
- [ ] `walletKitRegistry.get("sui")` returns a kit whose methods
      round-trip the fixture wallet (registration in Task 09).
- [ ] Unit tests cover create / balance / send / estimate / format /
      explorer-URL / token-balance dispatch.
- [ ] Spy tests confirm `sendNativeTransfer` / `sendTokenTransfer`
      delegate without inlining PTB code.
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Boot-time registration (Task 09).
- Create-new flow extension (Task 10).
- Bridge signer / `SuiAdapter` (Task 12).

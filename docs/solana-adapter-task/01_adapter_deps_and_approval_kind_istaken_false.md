# Task 01 — Adapter dependencies + `ApprovalKind` +3 variants

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.3a, §4.4, §5.

## Why this matters

The adapter introduces three Wallet Standard surfaces with no EVM
analog: SIWS, variadic `signAllTransactions` UX, and cluster switching.
`ApprovalKind` is shared by the bridge-wide `ApprovalIntent` type, so
adding the variants is a single surgical diff that unblocks every
1a/1b task that ships a new renderer. Deps land in the same task so the
next tasks can `import` from `@wallet-standard/core` /
`@solana/wallet-standard-features` immediately.

## Scope

- `package.json` — add:
  - `@wallet-standard/core` (latest) — `Wallet` / `WalletAccount` /
    `IdentifierString` contracts + event plumbing.
  - `@solana/wallet-standard-features` — canonical feature type
    definitions (`SolanaSignTransactionFeature`,
    `SolanaSignAndSendTransactionFeature`, `SolanaSignMessageFeature`,
    `SolanaSignInFeature`). Type hygiene only; the injected script
    hand-rolls the object.
  - `@solana/wallet-standard-chains` — `SOLANA_MAINNET_CHAIN` /
    `_DEVNET_CHAIN` / `_TESTNET_CHAIN` short-form identifiers.
  - `@solana-program/token` — classic SPL Token instruction decoder.
  - `@solana-program/token-2022` — Token-2022 instruction + extension
    decoder.
  - `@solana-program/address-lookup-table` — ALT lifecycle + read.
- `services/bridge/approval.ts` — apply diff per §4.3a:
  ```diff
   export type ApprovalKind =
     | "connect"
  +  | "signIn"
     | "signMessage"
     | "signTypedData"
     | "signTransaction"
     | "sendTransaction"
  +  | "signAllTransactions"
     | "switchChain"
  +  | "switchCluster"
     | "addChain"
     | "watchAsset"
     | "sendCalls"
     | "signAuthorization";
  ```
- `pnpm install` + commit lockfile.

## Rules (non-negotiable)

- **No runtime import from `@solana/wallet-standard-features`.** The
  package is consumed for its `type` exports only. The WebView cannot
  run npm code; the `TakumiSolanaWallet` object is built by hand in
  Task 03.
- **`signIn` is a shared kind, not Solana-specific.** SIWE on EVM may
  re-use the same `ApprovalKind="signIn"` variant later — naming it
  `solanaSignIn` now forces a rename.
- **No bridge-spine change beyond `approval.ts`.** `DappBridge`,
  `ApprovalHost`, `InspectorPipeline`, `BridgeEventBus` stay untouched.
- **Bundle budget.** `@solana-program/*` packages are tree-shaken on
  import; capture before/after Hermes bundle size for the R2 budget.

## Acceptance

- [ ] Deps installed; lockfile committed.
- [ ] `ApprovalKind` diff applied; `pnpm check:syntax` passes with no
      downstream EVM-side breakage (there shouldn't be — the union
      only gains variants).
- [ ] `pnpm biome:check` clean.
- [ ] Bundle-size delta recorded.

## Out of scope

- Using any of the new packages (Tasks 02–29).
- Type-level `SolanaApprovalPayload` expansion (Task 02).
- `TWallet` or signer dwell changes (owned by `solana-chain-support-spec`).

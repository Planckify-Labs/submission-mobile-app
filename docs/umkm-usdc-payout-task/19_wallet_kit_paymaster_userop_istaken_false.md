# Task 19 — `WalletKitAdapter.sendUserOpWithUsdcPaymaster` (EVM)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.4, §5.5 (wallet-kit
surface), §11 M4, §11.1 (`permissionless` dep), §12 Q6

## Why this matters

The one-time Gateway deposit is the only source-chain gas spend in the
whole product. Circle Paymaster on Base/Arbitrum lets us make even that
step USDC-denominated. Rest of the app never uses this method — so it
lives behind an optional `WalletKitAdapter` field and UI branches on
presence.

## Scope

- Implement `sendUserOpWithUsdcPaymaster` on `EvmWalletKit` per §5.5:
  - Use `permissionless` (`@permissionless/...`) to build the ERC-4337
    UserOperation with:
    - `paymasterAndData` assembled from the supplied `paymaster` address
      and EIP-2612 `permit` bundle.
    - `callData` encoding the caller-provided `calls[]` as a batch —
      either `executeBatch` on the smart account or a single `execute` call
      when there's exactly one.
    - Nonce / signature from the EVM account.
  - Submit to the Pimlico/Alchemy bundler specified by the per-chain env
    (`EXPO_PUBLIC_ERC4337_BUNDLER_*`).
  - Return `{ userOpHash }`. Caller polls for inclusion separately (task 22).
- Gate at build time:
  - If `args.chain.namespace !== "eip155"` → throw typed error.
  - If the wallet is an EOA and EIP-7702 is not yet live on the target
    chain (§12 Q6), throw `"NO_SMART_ACCOUNT"` — task 21 catches and
    renders `PAYMASTER_UNAVAILABLE` via the error matrix.
- Solana kit leaves the method `undefined`.
- Unit test the UserOp assembly against a fixture (permit + calls) against
  a known expected digest. Bundler submission is mocked.

## Rules (non-negotiable)

- **EIP-7702 decision per §12 Q6 must be resolved before merging M4.**
  Pick option (a) upgrade existing EOAs via authorization list gated by
  `EIP7702_ALLOWLIST`, or (b) require new smart-account at onboarding.
  Document the choice inline at the top of the file — future readers
  shouldn't have to re-derive this.
- **Branch on presence, not namespace.** UI callers use
  `if (kit.sendUserOpWithUsdcPaymaster)` — no `ns === "eip155"` in
  consumers.
- **Return hash only.** Don't wait for inclusion here; polling lives in
  task 22.
- **Never hardcode bundler URLs.** Env-driven only.

## Acceptance

- [ ] Method exists on `EvmWalletKit`, absent on Solana kit.
- [ ] Unit test with fixture permit + calls passes.
- [ ] Decision for §12 Q6 documented in the source header.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Gateway deposit service (task 20).
- UI onboarding screen (task 21).

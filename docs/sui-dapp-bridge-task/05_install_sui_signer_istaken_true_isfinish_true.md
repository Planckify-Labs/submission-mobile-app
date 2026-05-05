# Task 05 — `installSuiSigner` + `SuiSignerFns` interface

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §10 (boot diff), §11 (TWV-2026-YYY).

## Why this matters

The bridge must reach the Sui keypair through a *single dwell site* —
`getSuiSignerForWallet` (owned by the wallet-kit milestone). Routing all
signing through `SuiSignerFns` keeps the dwell-site invariant
auditable: there is exactly one place private material flows.

## Scope

- `services/chains/sui/SuiAdapter.ts` (extend with):
  - `interface SuiSignerFns`:
    - `signPersonalMessage(address, messageB64): Promise<string>` — returns
      base64 97-byte `flag(1)||sig(64)||pubkey(32)` per §1.4.
    - `signTransaction(address, txB64): Promise<{ bytes: string; signature: string }>`.
    - `signAndExecuteTransaction(address, txB64, network, options): Promise<{ digest: string; rawEffects?: string; rawTransaction?: string }>`.
  - `installSuiSigner(deps)` per §10:
    - `deps.getWalletByAddress(addr)` — pulls from active context.
    - `deps.getRpcForNetwork(network)` — returns `{ client: SuiClient }` with
      mainnet/testnet/devnet RPCs.
    - Resolves `walletKitRegistry.get("sui")` once at install time;
      throws if absent.
    - Each fn calls `kit.getSignerForWallet(wallet)` → `getSuiSignerForWallet`
      and uses `Ed25519Keypair.signPersonalMessage` /
      `Ed25519Keypair.signTransaction` from `@mysten/sui/keypairs/ed25519`.
    - `signAndExecuteTransaction` calls
      `client.executeTransactionBlock({ transactionBlock, signature, options })`.
  - `unregisterSuiSigner()` for tests.
- `services/chains/sui/SuiAdapter.test.ts` — extend with:
  - `installSuiSigner` + `signPersonalMessage` round-trip via stubbed
    keypair, verify via `verifyPersonalMessage` from `@mysten/sui`.
  - `signTransaction` round-trip → bytes + signature shape (97-byte sig).
  - Adapter `executeApproval` with no signer registered → `-32603`
    "No Sui signer registered" (regression test).

## Rules (non-negotiable)

- **Single dwell site.** `installSuiSigner` resolves the kit at install
  time, NOT per-request. Mobile UI and bridge share the kit reference.
- **No intent-prefix reimplementation.** Personal message signing uses
  `Ed25519Keypair.signPersonalMessage` — never reimplement `[0x03,0,0]`
  (§1.4 wire-format row 3).
- **Signature shape verbatim.** `executeApproval` returns the base64
  string from the SDK with no double-encoding (§1.4 wire-format row 2).
- **No private material logged.** `__DEV__` errors may include error
  message but never `messageB64`, `txB64`, signer internals.
- **Wallet-kit dependency.** This task assumes
  `walletKitRegistry.has("sui") === true`. The boot guard (Task 14)
  short-circuits when the kit is missing.

## Acceptance

- [ ] `installSuiSigner` round-trip tests green for all three fns.
- [ ] Adapter `executeApproval` returns `-32603` when signer not installed.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `executeApproval` per-intent branches (Tasks 06, 07).
- Boot-time call to `installSuiSigner` (Task 14).
- The `getSuiSignerForWallet` dwell-site itself — owned by the wallet-kit
  spec (`docs/sui-chain-support-spec.md`).

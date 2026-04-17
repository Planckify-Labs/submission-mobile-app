# Task 09 — Solana wallet creators + validators in `walletUtils.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §7.3, §6.2.

## Why this matters

The new onboarding sheets (Tasks 23–25) and the kit (Task 12) need
namespace-specific creators and validators. Putting them in the same
module as the existing EVM creators keeps the creation surface
discoverable and lets `createWalletFromParams` dispatch via the kit
registry without scattering knowledge.

## Scope

Add to `utils/walletUtils.ts`:

- `isValidSolanaAddress(s: string): boolean` — base58 decode + length
  32 bytes.
- `isValidSolanaPrivateKey(s: string): boolean` — base58 decode +
  length 32 or 64 bytes.
- `parseSolanaPrivateKey(s: string): Uint8Array | null` — accept 32- or
  64-byte base58, slice to 32-byte seed. Returns `null` on invalid
  input (never throws).
- `createSolanaWalletFromPrivateKey(pkBase58: string, name?: string): Promise<TWallet | null>`
  per §7.3 — uses `createKeyPairFromPrivateKeyBytes(bytes, { extractable: false })`
  + `getAddressFromPublicKey`.
- `createSolanaWalletFromMnemonic(mnemonic: string, name?: string): Promise<TWallet | null>`
  per §7.3 — calls `mnemonicToSolanaPrivateKey` (Task 07) + same kit
  calls.
- Make `createWalletFromParams` `async`. Dispatch by the widened
  `source` values:
  ```ts
  if (params.source === "SolanaPrivateKey" && params.privateKey)
    return createSolanaWalletFromPrivateKey(params.privateKey, params.name);
  if (params.source === "SolanaSeedPhrase" && params.seedPhrase)
    return createSolanaWalletFromMnemonic(params.seedPhrase, params.name);
  ```
  All call sites (`useWallet.addWallet`) already `await` inside
  `deferredTask`; this is a type-only change.
- Unit tests:
  - Validator accepts Phantom's 64-byte base58; rejects `0x`-hex.
  - `createSolanaWalletFromMnemonic` → address matches the Task 07
    golden-vector address.
  - `createSolanaWalletFromPrivateKey` → round-trip: exported key
    re-imported produces the same address.

## Rules (non-negotiable)

- **`extractable: false` on the `CryptoKey`.** Non-extractable is the
  TWV-2026-070 invariant — a PR that flips this must cite the review
  gate.
- **Validators never throw.** Return `false` / `null` on bad input so
  the UI can show a clean error.
- **Namespace lives on the wallet row.** Every returned `TWallet` has
  `namespace: "solana"` and populates `solana: { pubkeyBase58, … }`.
- **No cross-curve import.** An EVM 64-hex key fed to
  `createSolanaWalletFromPrivateKey` must fail validation — never
  return a "looks-like-Solana" wallet from EVM bytes (§14.6 hard rule).

## Acceptance

- [ ] New exports present and covered by unit tests (`walletUtils.test.ts`).
- [ ] `createWalletFromParams` is `async` and dispatches the two new
      `source` values.
- [ ] Existing EVM creator tests unchanged, still green.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Kit implementation (Task 12 wires these behind `WalletKitAdapter`).
- Signer reconstruction (Task 10).
- UI sheets that consume these (Tasks 23–25).

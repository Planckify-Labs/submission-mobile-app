# Task 02 — `TWallet.solana?` + widen `TWalletCreationParams.source`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §4.3, §6.2.

## Why this matters

A Solana wallet needs a place to live inside the existing `TWallet` row.
We already established that each wallet row keeps a single namespace
(§4.1), so adding an optional `solana?` block — mirroring the existing
`smart4337?` / `smart7702?` pattern — is the minimum-change extension.
The `source` union widens to let creation flows explicitly request a
Solana origin.

## Scope

- `constants/types/walletTypes.ts`:
  ```ts
  export interface TSolanaFields {
    pubkeyBase58: string;
    derivationPath?: string;
  }

  export interface TWallet {
    // …existing fields…
    solana?: TSolanaFields;
  }

  export interface TWalletCreationParams {
    source:
      | "social"
      | "SeedPhrase"
      | "PrivateKey"
      | "SolanaSeedPhrase"
      | "SolanaPrivateKey";
    privateKey?: string;
    seedPhrase?: string;
    name?: string;
    provider?: string;
    socialAccount?: { email: string; name: string };
    account?: any;
  }
  ```
- Grep for any downstream `switch (params.source)` or
  `if (params.source === …)` and confirm TypeScript exhaustiveness still
  holds. Do **not** add runtime handling yet — Tasks 09 / 12 will do
  that.

## Rules (non-negotiable)

- **`solana` is optional.** Existing EVM rows and legacy stored rows
  must round-trip unchanged.
- **`privateKey` stays `string`.** For Solana wallets it will carry the
  64-byte secret key **base58-encoded** (Phantom export format) — see
  §4.3. No new field, no format branch here.
- **`WalletType` is untouched.** Solana wallets reuse `"PrivateKey"` or
  `"SeedPhrase"`, disambiguated by `namespace`.
- **No creation-flow changes in this task.** `createWalletFromParams`
  stays EVM-only — Task 09 extends it.

## Acceptance

- [ ] `TSolanaFields` + `TWallet.solana?` exported from
      `constants/types/walletTypes.ts`.
- [ ] `TWalletCreationParams.source` accepts the four new literals.
- [ ] `pnpm check:syntax` passes.
- [ ] Running the existing `walletService` unit tests against a fixture
      EVM wallet still passes — no runtime behavior change.

## Out of scope

- Implementing `createSolanaWalletFromPrivateKey` / `FromMnemonic`
  (Task 09).
- `getSolanaSignerForWallet` / signer cache (Task 10).
- UI surface for the new source values (Tasks 23–25).

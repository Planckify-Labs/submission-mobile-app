# Task 01 — `TSuiFields` + extend `TWallet` / `TWalletCreationParams`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §2.2, §3.4, §8.1.

## Why this matters

The discriminator `TWallet.namespace` already lists `"sui"`
(`constants/types/walletTypes.ts:32`), but there is no `sui?` sub-object
to park chain-specific fields under. Without `TSuiFields`, downstream
code has to either jam Sui state into the EVM/Solana slots (which
poisons type narrowing) or guard every screen with `(wallet as any).sui`.
The Solana rollout proved that landing the type widening **before** any
implementation keeps every subsequent task pure and reviewable.

## Scope

- `constants/types/walletTypes.ts`:
  ```ts
  export interface TSuiFields {
    /** 0x-prefixed 32-byte hex (canonical Sui address). */
    suiAddress: string;
    /** Raw 32-byte ed25519 public key, hex. */
    pubkeyHex: string;
    /** SLIP-0010 ed25519 path. */
    derivationPath?: string;     // default `m/44'/784'/0'/0'/0'`
    /** Signing scheme; only `ed25519` in v1. */
    scheme: "ed25519";
  }

  export interface TWallet {
    // ...existing fields
    sui?: TSuiFields;
  }
  ```
- Extend `TWalletCreationParams.source` union with `"SuiSeedPhrase"`
  and `"SuiPrivateKey"`.
- `TWallet.privateKey` semantic note (comment): for Sui rows, holds the
  bech32 `suiprivkey1…` form so the dwell site re-decodes without
  re-running BIP-39 derivation. `TWallet.address` mirrors `suiAddress`.

## Rules (non-negotiable)

- **No implementation in this task.** Types only. Any `import` from
  `@mysten/sui` here is a review block — keep this file dependency-free
  the same way the Solana widening landed.
- **`scheme` is a literal union, not `string`.** Future Secp256k1 / r1
  support requires a new gate (§6) — the type system should force
  reviewers to think about it.
- **`namespace: "sui"` is already declared** at line 32 — do not
  duplicate the union member, just fill the slot.
- **Optional `derivationPath`.** Present only when a non-default path
  was used; absent means `m/44'/784'/0'/0'/0'`.

## Acceptance

- [ ] `TSuiFields` exported from `constants/types/walletTypes.ts`.
- [ ] `TWallet.sui?: TSuiFields` declared.
- [ ] `TWalletCreationParams.source` includes both Sui variants.
- [ ] `pnpm check:syntax` passes — no downstream code yet consumes the
      slot, so this should be a zero-error type-only diff.
- [ ] No new `import` statements in `walletTypes.ts`.

## Out of scope

- Wallet creators that populate `sui` (Task 06).
- `ChainConfig` widening (Task 02).
- Validators (Task 06).

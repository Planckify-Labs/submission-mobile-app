# Task 03 — `derivation.ts` — BIP-39 → SLIP-0010 ed25519 `m/44'/784'/0'/0'/0'`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §1.4, §3.2, §6.

## Why this matters

Sui uses SLIP-0010 fully-hardened ed25519 derivation at coin type **784**
with a five-level path (`m/44'/784'/0'/0'/0'`) — different shape than
EVM's BIP-44 secp256k1 and Solana's four-level SLIP-0010. Without a
shared derivation helper, the same mnemonic would yield different
addresses on our wallet vs. Sui Wallet / Suiet / Surf. The derivation
module is small, pure, and round-tripped against a golden vector so
any regression is caught immediately.

## Scope

- `services/chains/sui/derivation.ts`:
  ```ts
  import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

  export const DEFAULT_SUI_PATH = "m/44'/784'/0'/0'/0'";

  export function mnemonicToSuiKeypair(
    mnemonic: string,
    path: string = DEFAULT_SUI_PATH,
  ): Ed25519Keypair {
    return Ed25519Keypair.deriveKeypair(mnemonic, path);
  }
  ```
- `services/chains/sui/derivation.test.ts` — golden vector. The BIP-39
  test mnemonic
  `"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"`
  on `m/44'/784'/0'/0'/0'` → known Sui-Wallet-verified 0x address
  (capture once via Sui Wallet import; hard-code the vector).

## Rules (non-negotiable)

- **Default path is `m/44'/784'/0'/0'/0'`** (Sui registered coin type
  784, fully-hardened, five-level — Phantom-style "first account"
  parity matches Sui Wallet, Suiet, Surf). Allow override for power
  users, but every first-party creation flow uses the default.
- **Use `Ed25519Keypair.deriveKeypair` from the SDK.** Re-implementing
  SLIP-0010 by hand is the bug class the SDK already handles. Only fall
  back to `@noble/*` if Task 00 surfaced a Hermes blocker.
- **Pure function, no I/O.** No secure-store reads, no `console.log`,
  no Buffer dependency in this module's runtime path.
- **No `Math.random` / no fallbacks.** If the SDK throws, propagate —
  do not synthesize a key from weaker randomness.
- **Never logs the keypair.** The returned object holds 32 bytes of
  secret material; `console.log` of any field on it is forbidden.

## Acceptance

- [ ] `services/chains/sui/derivation.ts` exports `DEFAULT_SUI_PATH`
      and `mnemonicToSuiKeypair`.
- [ ] Golden-vector test passes under `pnpm run test`.
- [ ] Running the same mnemonic + path through Sui Wallet's import flow
      yields the same 0x-address (manual cross-check, recorded in the
      PR description).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Wallet creators that consume this (Task 06).
- Signer dwell site (Task 05).
- Bech32 / address-string codecs (Task 04).

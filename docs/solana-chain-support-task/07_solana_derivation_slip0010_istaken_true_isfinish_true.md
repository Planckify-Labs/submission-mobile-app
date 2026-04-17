# Task 07 — `derivation.ts` — BIP-39 → SLIP-0010 ed25519 `m/44'/501'/0'/0'`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §3.4, §7.2.

## Why this matters

Solana uses SLIP-0010 (hardened ed25519) derivation, not BIP-44
secp256k1. Without a shared derivation helper, the same mnemonic would
yield different addresses on our wallet vs. Phantom / Solflare. The
derivation module is small, pure, and round-tripped against a golden
vector so any regression is caught immediately.

## Scope

- `services/chains/solana/derivation.ts`:
  ```ts
  import { mnemonicToSeedSync } from "@scure/bip39";
  import { derivePath } from "ed25519-hd-key";

  export const DEFAULT_SOLANA_PATH = "m/44'/501'/0'/0'";

  export function mnemonicToSolanaPrivateKey(
    mnemonic: string,
    path: string = DEFAULT_SOLANA_PATH,
  ): Uint8Array {
    const seed = mnemonicToSeedSync(mnemonic);
    const { key } = derivePath(path, Buffer.from(seed).toString("hex"));
    return new Uint8Array(key); // 32-byte ed25519 seed
  }
  ```
- `services/chains/solana/derivation.test.ts`: golden vector —
  the BIP-39 test mnemonic `"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"`
  on `m/44'/501'/0'/0'` → known Phantom-verified base58 address
  (capture the address via Phantom once; hard-code the vector).

## Rules (non-negotiable)

- **Default path is `m/44'/501'/0'/0'`** (BIP-44 Solana coin type +
  Phantom default). Allow override for power users, but every
  first-party creation flow uses the default.
- **Pure function, no I/O.** No secure-store reads, no console.log, no
  Buffer polyfills — `@scure/bip39` and `ed25519-hd-key` are sufficient.
- **No `Math.random` / no fallbacks.** If `ed25519-hd-key` fails, throw
  — do not synthesize a key from weaker randomness.
- **Never logs `bytes`.** The returned `Uint8Array` is secret material;
  `console.log` of this module's internals is forbidden.

## Acceptance

- [ ] `services/chains/solana/derivation.ts` exports
      `DEFAULT_SOLANA_PATH` and `mnemonicToSolanaPrivateKey`.
- [ ] Golden-vector test passes under `pnpm run test`.
- [ ] Running the same mnemonic + path through Phantom's import flow
      yields the same base58 address (manual cross-check, recorded in
      the PR description).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Wallet creators that consume this (Task 09).
- Signer dwell site (Task 10).
- Base58 encoding (Task 08).

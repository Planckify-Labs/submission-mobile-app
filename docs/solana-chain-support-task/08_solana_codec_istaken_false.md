# Task 08 — `codec.ts` — base58 / base64 / transaction round-trip

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §6.1, §7.8.

## Why this matters

`TWallet.privateKey` carries base58-encoded bytes for Solana
(Phantom export format). `SolanaSignTxPayload.transaction` arrives from
the WebView as base64. The signer dwell site (Task 10) and the bridge
signer (Task 17) both need small, non-allocating glue between those
encodings and `@solana/kit`'s wire formats. Centralising keeps encoding
logic out of the dwell site — the fewer things that touch secret bytes,
the better.

## Scope

- `services/chains/solana/codec.ts`:
  - `base58ToBytes(s: string): Uint8Array` — via `bs58`.
  - `bytesToBase58(b: Uint8Array): string` — via `bs58`.
  - `base64ToTransaction(b64: string): Transaction` — decode wire-
    format transaction via `@solana/kit`.
  - `transactionToBase64(tx: Transaction): string` — encode wire-format
    transaction via `@solana/kit`'s `getBase64EncodedWireTransaction` or
    equivalent.
- Unit tests: round-trip each pair, plus a fixture transaction from a
  known devnet signature.

## Rules (non-negotiable)

- **No secret logging.** This module handles private-key bytes on input
  paths; `console.log` on `Uint8Array` arguments is forbidden.
- **No new Buffer use beyond `bs58`'s internal needs.** Keep the hot
  path `Uint8Array`-first for Hermes parity.
- **Phantom compat.** Accept the 64-byte (secret + pubkey) base58 form
  **and** the 32-byte seed form. `parseSolanaPrivateKey` (Task 09)
  calls through here, slicing to 32 when given 64.

## Acceptance

- [ ] `services/chains/solana/codec.ts` exports the four functions.
- [ ] Round-trip test: `bytesToBase58(base58ToBytes(x)) === x` for a
      known Phantom export fixture.
- [ ] Transaction round-trip: `transactionToBase64(base64ToTransaction(tx64)) === tx64`
      for a devnet fixture (normalised for stable ordering).
- [ ] `pnpm check:syntax` passes; `pnpm run test` passes.

## Out of scope

- Consuming this from the signer (Task 10) or bridge (Task 17).
- Any display formatting — that's the kit's `formatNativeAmount`
  (Task 12).

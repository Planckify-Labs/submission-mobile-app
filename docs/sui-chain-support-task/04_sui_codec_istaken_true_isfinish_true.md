# Task 04 — `codec.ts` — bech32 (`suiprivkey1…`), address derivation, intent helpers

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §1.4, §1.5, §3.2.

## Why this matters

Sui Wallet 0.7.0+ exports private keys as bech32 `suiprivkey1…` strings;
legacy 32-byte hex / base64 inputs are still accepted by the SDK. The
codec module is the single place that decides "is this string a Sui
secret?" and converts it to the 32-byte ed25519 seed the dwell site
feeds into `Ed25519Keypair.fromSecretKey`. The intent helpers wrap the
SDK's `messageWithIntent` so transfer / signing code never reconstructs
intent bytes by hand (the bug class TWV-2026-XXX guards against).

## Scope

- `services/chains/sui/codec.ts`:
  - `decodeSuiPrivateKey(input: string): Uint8Array` — accepts:
    1. `suiprivkey1…` (bech32, Sui Wallet 0.7.0+ canonical).
    2. Raw 32-byte hex (`0x`-prefixed or bare).
    3. Base64 32-byte payload.
    Returns the 32-byte ed25519 seed; throws a typed error otherwise.
    Uses `@scure/base` bech32 (transitive of `@scure/bip39`); fallback
    is the 50-line decoder lifted from `@mysten/sui` source.
  - `encodeSuiPrivateKey(seed: Uint8Array): string` — bech32 encode
    (canonical export form for `TWallet.privateKey`).
  - `deriveSuiAddressFromPubkey(pubkey: Uint8Array): string` — wraps
    `toSuiAddress` from the SDK; returns `0x` + 64 hex.
  - `messageWithSuiIntent(scope: "transaction" | "personal", bytes: Uint8Array): Uint8Array`
    — thin re-export of `messageWithIntent` from
    `@mysten/sui/cryptography` so call sites depend on this module
    rather than the SDK directly.
- `services/chains/sui/codec.test.ts` — vectors from
  `@mysten/sui` test fixtures + a Sui-Wallet-exported `suiprivkey1…`
  → seed → address round-trip.

## Rules (non-negotiable)

- **Prefer SDK helpers over hand-rolled crypto.** `toSuiAddress` and
  `messageWithIntent` are SDK-exposed; use them. The 50-line bech32
  fallback only exists for `decodeSuiPrivateKey` if `@scure/base`'s
  bech32 import path turns out unbundled (verify before writing the
  fallback).
- **Decoder errors are typed.** Throw
  `InvalidSuiPrivateKeyEncodingError` (registered in Task 07's
  `errorCodes.ts`) — never a raw `Error("bad input")`. Validators
  upstream depend on the discriminator.
- **No leaky logging.** This module operates on secret bytes. No
  `console.log`, no Sentry breadcrumb that includes input bytes.
- **Address output is canonical.** `0x` lowercase + 64 hex chars
  (66-char total). Reject 20-byte legacy addresses at the validator
  layer (Task 14), not here — the codec is encoding-only.

## Acceptance

- [ ] `services/chains/sui/codec.ts` exports the four functions above.
- [ ] Round-trip vector test: `seed → suiprivkey1… → seed` byte-equal.
- [ ] Address-derivation test matches Task 03 golden vector.
- [ ] Intent-bytes test: `messageWithSuiIntent("personal", bytes)`
      matches the SDK's own output for the same input.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Validators (Task 06) — the codec exposes "decode or throw"; the
  predicate `isValidSuiPrivateKey` lives in `walletUtils.ts`.
- Transfer-service intent wrapping (Task 07) — call sites depend on
  this module for intent helpers; the module is dependency-free.
- Signer dwell (Task 05).

# Task 02 — Verify OS CSPRNG for wallet generation

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-002, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

Trust Wallet Core <3.1.1 seeded mt19937 with a 32-bit value and lost
$6M+ — any address generated that way is enumerable in minutes. Under
Hermes the global `crypto.getRandomValues` only exists if
`react-native-get-random-values` (or `expo-crypto`) is imported before
any Viem call. The spec pins this to `services/walletService.ts` and
`pollyfills.ts` — if a future refactor moves the polyfill import below
a Viem-importing module, seed entropy silently collapses to `Math.random`
fallback with no visible failure. §9 "Key custody" row requires this
to be assert-tested, not just configured.

## Scope

1. In `pollyfills.ts`, confirm `react-native-get-random-values` (or
   `expo-crypto` equivalent) is the first import and document the
   ordering invariant in a top-of-file comment.
2. In `services/walletService.ts`, route all mnemonic / private-key
   generation through `@scure/bip39` + `expo-crypto.getRandomBytesAsync`
   (16 or 32 bytes). Reject any code path that calls `Math.random`,
   `Date.now()`-seeded PRNGs, or bare `new Uint8Array(…)` without
   filling from the CSPRNG.
3. Add a unit test that asserts the global `crypto.getRandomValues` is
   present at module load of `walletService.ts` and that generated
   mnemonics pass the `@scure/bip39` checksum. Include a negative test
   that fails loudly if the polyfill import is removed.
4. Keep the public `walletService` API (create / import / export
   wallet) byte-identical — §7 forbids signature changes here.

## Rules (non-negotiable)

- **OS CSPRNG only.** Every byte of entropy that lands in a seed or
  private key must originate from `SecRandomCopyBytes` (iOS) or
  `SecureRandom` (Android) via `expo-crypto` / `react-native-get-random-values`.
- **Polyfill import must precede every Viem import in the app entry
  graph.** Enforced by the comment + unit test, not by convention.
- **No reimplementation of BIP-39.** Use `@scure/bip39`; no hand-rolled
  entropy-to-mnemonic mapping.
- **Forward migration only (§7.3).** Existing wallets keep working;
  nothing about stored seeds changes.

## Acceptance

- [ ] `pollyfills.ts` first line is the CSPRNG polyfill import, with a
      comment stating "must stay first — precedes Viem".
- [ ] `services/walletService.ts` seed generation is sourced from
      `expo-crypto.getRandomBytesAsync`; grep shows zero `Math.random`
      calls on any wallet-creation path.
- [ ] Unit test asserts `globalThis.crypto.getRandomValues` is a
      function at the point `walletService` is imported, and that
      `bip39.validateMnemonic(generated)` returns true.
- [ ] Manual regression: create a fresh wallet, import an existing
      seed, export mnemonic — all three flows complete unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Moving private-key storage into a native module (tracked under
  TWV-2026-057 / §9 "Private key plaintext never returned to JS").
- Key Attestation at launch (TWV-2026-062, Phase 2).
- Vanity-prefix / Profanity-class detection on import (TWV-2026-040,
  Phase 3).

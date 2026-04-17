# Task 01 — Dependencies + Ed25519 polyfill + TWV-2026-070 boot check

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-chain-support-spec.md` §5, §7.1, §3.3.

## Why this matters

Hermes' WebCrypto ships without Ed25519. Any `@solana/kit` import that
reaches `subtle.generateKey({name:'Ed25519'}, …)` throws at runtime, and
a silent fallback would break TWV-2026-046 (software signing parity).
Landing the polyfill first — with a fail-loud self-check, analogous to
the existing TWV-2026-002 CSPRNG check — ensures every Solana task that
follows can assume Ed25519 just works.

## Scope

- `package.json`: add
  - `@solana/kit` (latest v2.x)
  - `@solana-program/system`
  - `@solana/webcrypto-ed25519-polyfill`
  - `ed25519-hd-key`
  - `bs58`
  (`@scure/bip39` is already present via viem.)
- `pollyfills.ts`: add `import "@solana/webcrypto-ed25519-polyfill";`
  **after** `react-native-get-random-values` and
  `fastestsmallesttextencoderdecoder`, **before** any kit import.
- Append the TWV-2026-070 self-check block from §7.1: an IIFE that calls
  `crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])`
  and throws a loud `"TWV-2026-070: Ed25519 unavailable at boot — …"` on
  failure.
- `pnpm install` + commit lockfile.

## Rules (non-negotiable)

- **Import order is load-bearing.** The polyfill must run before any
  `@solana/kit` module is evaluated. Any code that imports from
  `@solana/kit` must chain through `pollyfills.ts` first.
- **Fail loud on boot.** The self-check uses `throw`, not `console.warn`
  — a missing polyfill is an incident, not a hint.
- **No `Math.random` anywhere on the new path.** The polyfill delegates
  to WebCrypto which uses the OS CSPRNG (TWV-2026-002). Do not introduce
  shims that fall back to `Math.random`.
- **No Solana code merged in this task.** This is pure plumbing —
  subsequent tasks import `@solana/kit` for real.

## Acceptance

- [ ] `pnpm install` clean; lockfile committed.
- [ ] Fresh dev-client boot (iOS + Android) shows no TWV-2026-070 throw
      in Metro logs.
- [ ] Temporarily commenting out the polyfill import reproduces the
      TWV-2026-070 throw at boot (manual sanity check; revert before
      merging).
- [ ] `pnpm check:syntax` passes; `pnpm biome:check` clean.
- [ ] Bundle-size diff captured for R2 budget tracking (+250 KB JS
      budget per the risk register).

## Out of scope

- Using kit APIs beyond the self-check (Tasks 07+).
- Any `TWallet` / `ChainConfig` changes (Tasks 02, 03).

# Task 00 — Hermes / RN compatibility smoke test for `@mysten/sui`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §3.1, §10 (row 00), §11 (risk row 1).

## Why this matters

`@mysten/sui` is the official MystenLabs SDK and the only sane choice for
intent prefixes, BCS serialisation, and `Ed25519Keypair` signing — but it
historically pulled in Node-only crypto (`crypto`, `stream`) that Hermes
can't load. If the SDK throws on import or on first call, the entire
spec collapses into a "build it from `@noble/*` like Solana did" rewrite.
We need to know that on day zero, before anyone writes derivation,
codec, or kit code.

## Scope

- `app/_dev/sui-compat.tsx` — throw-away dev screen exercising the SDK
  surface that the rest of the spec depends on:
  - `Ed25519Keypair.deriveKeypair(mnemonic, "m/44'/784'/0'/0'/0'")`
  - `keypair.toSuiAddress()` — assert 0x + 64 hex chars
  - `keypair.signPersonalMessage(new TextEncoder().encode("hello"))`
  - `new Transaction(); tx.splitCoins(tx.gas, [tx.pure.u64(1n)]);
     tx.transferObjects(...); await tx.build({ client })` against a
    `SuiClient({ url: "https://fullnode.mainnet.sui.io:443" })`
  - `messageWithIntent` from `@mysten/sui/cryptography`
  - `bech32` decode of a `suiprivkey1…` test vector
- Render PASS/FAIL for each step on screen.
- Capture iOS + Android Metro logs in the PR description.
- Delete the screen + remove the route once green.

## Rules (non-negotiable)

- **Run on a real dev-client build, not Expo Go.** Hermes parity only
  matters under the actual binary that ships.
- **Test on both iOS and Android.** The bundlers differ enough that one
  passing does not imply the other passes (cf. the `react-native-quick-
  crypto` rollout).
- **No fallback work in this task.** If the SDK fails, file a follow-up
  to route through `@noble/hashes` + `@mysten/bcs` per §11 risk row 1
  — do not start that work in the same PR.
- **Delete the screen before merging the next task.** Leaving a
  `_dev/` route in the bundle leaks SDK surface to production.

## Acceptance

- [ ] All five SDK calls return non-throwing results on iOS and Android
      dev-client builds.
- [ ] PR description contains screenshots of the PASS rows + Metro logs
      showing no Hermes errors.
- [ ] `pnpm check:syntax` passes; `pnpm biome:check` clean.
- [ ] Bundle-size delta recorded for Phase 1 reviewer reference.
- [ ] Follow-up issue filed if any call fell back to a `@noble/*` route.

## Out of scope

- Any non-throwaway SDK code (Tasks 03+).
- Adding `@mysten/sui` to `pollyfills.ts`. The polyfills already in tree
  (`react-native-quick-crypto`, `react-native-get-random-values`,
  `TextEncoder`) are the contract — this task verifies the SDK runs
  against them as-is.
- API seed-script changes (Task 15).

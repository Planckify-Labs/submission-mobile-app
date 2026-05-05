# Task 00 — Verify `@mysten/sui/transactions` `Transaction.from(bytes)` round-trip in WebView runtime

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §13 (task 00), §14 (risk row 1).

## Why this matters

The PTB decoder inspector (Task 08) and the injected-shim normalisation
path (§5.5) both depend on `Transaction.from(bytes)` and `tx.getData()`
behaving identically inside the React Native WebView's WebKit/Chromium
runtime. The Mysten SDK changed the decoded shape between minor versions
(`tx.getData().commands` vs `tx.blockData.transactions`); confirming the
shape *now*, on the SDK version we'll pin, prevents every later inspector
task from re-discovering it.

## Scope

- Add a throw-away `app/_dev/sui-ptb-decode.tsx` route.
- Construct a known PTB in JS (e.g. `tx.transferObjects([tx.gas], "0x...")`),
  call `await tx.build({ client })`, base64-encode, then decode via
  `Transaction.from(bytes)` and read `getData()`.
- Assert: the decoded shape exposes `commands`, `inputs`, `gasData`,
  `sender` (after `setSender`), `gasData.budget`, `gasData.price`.
- Pin the verified `@mysten/sui` version in `package.json`. Document the
  shape in a comment block at the top of `services/chains/sui/inspector.ts`
  (created in Task 08) so the next dev knows which fields are load-bearing.
- Leave the dev route in tree but unlinked from any nav surface.

## Rules (non-negotiable)

- **No production code merged.** This task is research-only.
- **Pin the SDK version exactly.** No caret. The decoder shape is
  load-bearing for inspector accuracy.
- **Document both shapes if both are present in the pinned version** —
  some Mysten releases expose the legacy `blockData` shim alongside
  `getData()`. The decoder shim in Task 08 must handle whichever the
  pinned version provides.

## Acceptance

- [ ] Round-trip succeeds in the WebView (verified via dev route on
      iOS + Android).
- [ ] `@mysten/sui` version pinned in `package.json`.
- [ ] One-paragraph note added to the spec (`sui-dapp-bridge-spec.md`
      §14 risk row 1) with the verified shape — strikethrough the risk.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Decoder implementation (Task 08).
- Any production code that imports `@mysten/sui/transactions`.

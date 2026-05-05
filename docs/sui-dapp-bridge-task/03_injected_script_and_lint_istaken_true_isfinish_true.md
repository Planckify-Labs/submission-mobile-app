# Task 03 — `services/chains/sui/injectedScript.ts` + Wallet Standard lint suite

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §5 in full.

## Why this matters

The injected shim is the only piece of code the dApp's JS runtime sees.
If discovery (`wallet-standard:register-wallet` + `app-ready`) is wrong
or feature-function identity drifts across re-injects, reactive dApps
(Sui dApp Kit, Suiet kit) silently fail to bind to TakumiPay. The lint
suite enforces the Wallet Standard contract before any browser ever
runs the script.

## Scope

- `services/chains/sui/injectedScript.ts`:
  - IIFE wrapped per `injectedJavaScriptBeforeContentLoaded` semantics.
  - `≤ 5 KB gzipped`.
  - Idempotent: re-running re-dispatches `register-wallet` only.
  - Surface: `window.__takumi_sui_installed`, `window.__takumi_sui_wallet`,
    `window.__takumi_sui_nonce`, `window._updateSuiWallet`,
    `window._handleEthereumResponse` (legacy demux name kept).
  - **No `window.sui` legacy global** (§5.2 — Wallet Standard discovery only).
  - Handshake per §5.3: register + `app-ready` listener that re-registers.
  - Feature surface per §5.4: nine features including the two legacy
    aliases (`sui:signTransactionBlock`,
    `sui:signAndExecuteTransactionBlock`) pointing at the same RPC handler
    as their current counterparts.
  - `normaliseTx(t)` per §5.5: `Transaction.toJSON()` → string,
    `Uint8Array` → base64, `ArrayBuffer` → base64, already-base64 string
    pass-through, throw otherwise.
  - Session-nonce stamping per §5.6: read `window.__takumi_sui_nonce`
    *at request time*, not closure-captured.
- `services/chains/sui/__wallet-standard-lint.ts`:
  - Mirror `services/chains/solana/__wallet-standard-lint.ts`.
  - Run via `node --test --experimental-strip-types`.
  - Assert all six rows from spec §5.7 (version + name + icon, chains
    array, every required feature key, feature-function identity stable
    across re-inject, accounts starts empty / publicKey is `Uint8Array(32)`
    post-connect, legacy method routes to same handler).
- `services/chains/sui/injectedScript.test.ts`: shim-level unit tests
  for `normaliseTx`, idempotency, nonce stamping.

## Rules (non-negotiable)

- **Wallet Standard discovery only.** No `window.sui` shim, ever (§5.2).
- **Feature-function identity is stable across re-inject.** Same closure
  reference per `S(method, …)` family — Inv 18 from the Solana lint suite.
- **`accounts: []` pre-connect.** Pre-populating an active account
  causes Sui-side libraries to skip `connect` entirely (§4.5 bug class).
- **Nonce read at call time.** Closure-capturing the nonce breaks SPA
  navigation flows after the bridge rotates the nonce ring.
- **Shim never calls `client.executeTransactionBlock`.** That's the
  adapter's job (§5.5 final paragraph).

## Acceptance

- [ ] Lint suite green (`node --test --experimental-strip-types
      services/chains/sui/__wallet-standard-lint.ts`).
- [ ] Bundled shim size ≤ 5 KB gzipped.
- [ ] Re-running the IIFE in the same WebView page is a no-op except for
      the re-dispatched `register-wallet` event.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Adapter-side handling of incoming requests (Task 04).
- Bridge-side signing (Tasks 05–07).

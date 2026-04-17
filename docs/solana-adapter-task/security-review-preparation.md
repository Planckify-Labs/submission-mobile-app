# Task 34 — §10.4 invariants + shim attack-surface review (preparation)

**Status:** Blocked on Security team review session.
**Owner:** Security (with Mobile support).

This file maps each §10.4 invariant to the code / tests that enforce it, so
the reviewer can audit rather than discover. Actual sign-off happens when a
security-team reviewer walks this list, verifies the linked artefact, and
ratifies.

## Invariant ↔ enforcement map

| # | Invariant | Enforced by | Test artefact |
|---|---|---|---|
| 1 | SIWS domain binding | `SolanaSiwsInspector` emits `danger` on mismatch | visual: sheet + banner |
| 2 | Address-swap protection | `SolanaAdapter.handleSignIn` rejects 4100 pre-sheet | `SolanaAdapter.errorCodes.test.ts` |
| 3 | Fee-payer trust | `partialSigner.ts::analysePartialSigner` | sheet banner row |
| 4 | Durable-nonce authority | `durableNonce.ts::detectDurableNonce` + annotation | unit test pending |
| 5 | ALT expansion | `altResolver.ts::resolveAltReferences` tracks `tableSize` | unit test pending |
| 6 | Writable-account drain | `SolanaSimulationInspector` writable-warning branch | unit test pending |
| 7 | `setAuthority` / ATA hijack | `programDecoders.extras.ts` RecoverNested detection | unit test pending |
| 8 | Token-2022 extensions surfaced | `token2022.ts::parseToken2022Extensions` severity map | unit test pending |
| 9 | SIWS expiry sanity | `siws.ts::buildSiwsMessage` rejects `expirationTime ≤ issuedAt` | `siws.test.ts` |
| 10 | No signer reconstruction in adapter | grep check — only `services/walletService.ts` touches private key material | manual grep |
| 11 | Redaction on BridgeEventBus | `redact.ts` Solana branch | `redact.test.ts` (6 Solana-specific tests) |
| 12 | Session-nonce gate | Inherited from TWV-2026-015; injected script stamps `__takumi_nonce` | `DappBridge.test.ts` |
| 13 | Wallet Standard wire types | `publicKey: Uint8Array(32)` in injected script | `__wallet-standard-lint.ts` |
| 14 | `supportedTransactionVersions` literal | Frozen tuple, not a getter | `__wallet-standard-lint.ts` |
| 15 | `silent: true` never opens a sheet | `SolanaAdapter.handleConnect` returns resolved/4100 | `SolanaAdapter.errorCodes.test.ts` (silent + no grant) |
| 16 | No `Wallet.chains` narrowing on switchCluster | `onStateChange` patches `accounts`, not `chains` | code review |
| 17 | Legacy shim `signIn` throws 4200 | `window.solana.signIn` in injected script | `__wallet-standard-lint.ts` coverage + manual browser check |
| 18 | Stable feature-function identity | Feature functions declared once per IIFE install | `__wallet-standard-lint.ts` idempotent-install check |
| 19 | No RPC from the WebView | All methods route via `bridge_request`; zero `fetch` in injected script | grep check |
| 20 | No provider API keys in bundle | `solanaRpcPool.ts` warns on prod override, proxy default | bundle scan + `solanaRpcPool.test.ts` |
| 21 | Cluster-scoped grants | `PermissionStore.grant` keyed by `caip2Cluster` string | code review + `PermissionStore` type |
| 22 | SNS advisory — never sign from domain | `sns.ts::resolveSnsDomain` returns base58 or null | code review |
| 23 | Batch cap N ≤ 20 | `SolanaAdapter.handleSignTransaction` rejects -32602 | `SolanaAdapter.errorCodes.test.ts` |

## Shim surface audit (§10.6 reviewer checklist)

- `window.solana` exposes exactly the documented keys (13 properties).
- `window.phantom.solana` mirrors `window.solana` but never clobbers existing
  phantom keys.
- `isPhantom: true` + `isTakumi: true` — **deliberate deviation from
  spec §10.6**. Uniswap's "Switch Solana wallet" view (and similar
  legacy-detection dApps) checks `window.solana.isPhantom === true`
  rather than using Wallet Standard discovery; a user connected via
  our WS feature sees "No Solana wallet detected" when opening that
  view otherwise. Every major non-Phantom Solana wallet ships
  `isPhantom: true` for the same reason (Backpack, Solflare, Glow,
  OKX). `isTakumi` is always the authoritative identity flag for
  dApps that know about us.
- `signIn` on the shim throws 4200.
- All method parameters marshalled through `bridge_request` with session nonce.

## Redaction proof (§10.4 inv 11)

`services/bridge/redact.test.ts` adds 6 Solana-specific tests asserting:

- `solana:signMessage` breadcrumb drops the message body.
- `solana:signTransaction` / `signAndSendTransaction` drop the base64 tx
  body across every batch position.
- `solana:signIn` drops `nonce` values and never surfaces `signature`.
- `standard:connect` reduces to `{ silent: bool }`.
- `takumi:switchCluster` / `watchToken` pass through (no secrets).

## Sign-off

Reviewer: _________________  Date: _____________  PR: _____________

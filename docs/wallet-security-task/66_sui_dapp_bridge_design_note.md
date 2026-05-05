# Task 66 — Sui dApp bridge design note (TWV-2026-YYY)

**Status:** Design note. Documents the gates implemented in
`docs/sui-dapp-bridge-task/` Tasks 04, 05, 06, 07.
**Companion task file:**
`docs/sui-dapp-bridge-task/22_twv2026yyy_sui_dapp_design_note_istaken_true.md`
**Review gate:** Cited as the top-of-file comment block in
`services/chains/sui/SuiAdapter.ts` (`executeApproval`) and
`services/chains/sui/signer.ts` (`installSuiSigner`). Any PR that touches
the Sui dApp bridge sign path must reference this note.

> NOTE on numbering: The placeholder `TWV-2026-YYY` is in the spec until
> security issues the real number. When the number lands, replace every
> `TWV-2026-YYY` here, in `docs/sui-dapp-bridge-spec.md` §11, in the
> `installSuiSigner` and `SuiAdapter.executeApproval` comment blocks,
> and in this file's title.

## 1. Purpose — why TWV-2026-YYY exists

Lighting up the in-app dApp browser for Sui introduces a third
namespace's signing surface to TakumiPay. Three properties of the
combined system make it non-trivial:

- **Wallet Standard exposes the wallet object inside the WebView's JS
  realm.** A malicious dApp script controls the entire DOM and can
  inspect `window.__takumi_sui_wallet`. The single property we depend
  on is that the wallet's feature functions never *return* private
  material — they marshal a request to the native side and emit signed
  base64 blobs back. A regression that caches a keypair in the closure
  would silently weaken the property.
- **Cross-namespace trust is a UX shortcut a reviewer will be tempted
  to take.** The Solana adapter already enforces the same property at
  `SolanaAdapter:303-305`. The temptation is to "auto-grant" Sui access
  on a connect from an origin that has a recent EVM grant — the user
  trusts the dApp, why prompt twice? Because EVM and Sui are different
  identities (different addresses, different signing surfaces), an
  EVM grant carries zero authorisation for Sui. Always prompt.
- **A regression surfaces far from the cause.** If `SuiSignerFns` is
  ever asked to sign something the user did not approve (e.g. a sheet
  decoder mismatch, an `executeApproval` branch that picks the wrong
  wallet), the failure shows up as an unexpected on-chain transaction
  hours later. The gate must compose all three invariants so that
  reviewers reading any one of them see the others nearby.

TWV-2026-YYY packages those into a tri-invariant gate.

## 2. Invariants

### 2.1 Bridge sign path goes through `SuiSignerFns` only

The signer reaches the Ed25519 keypair through
`getSuiSignerForWallet` — the single dwell site introduced by the
wallet-kit spec (TWV-2026-XXX). The bridge does not import the keystore.
The bridge does not run BIP-32 / SLIP-0010 derivation. The bridge does
not reconstruct the seed.

`installSuiSigner` resolves the kit ONCE at install time (mirror of
`installSolanaSigner` at `services/chains/solana/signer.ts:104`).
Per-request resolution would (a) pay the map lookup cost on every
bridge RPC and (b) widen the window during which a boot-order bug
could surface mid-session.

**Failure mode prevented:** A regression that shipped a second
keypair-materialisation site under `services/chains/sui/` (e.g. an
"optimisation" that decoded the seed inside the inspector for SIWS)
would make TWV-2026-XXX's single-dwell-site claim no longer true. CI
catches this via the boot self-check from the wallet-kit spec; PR
review catches via this note's PR citation requirement (§3).

### 2.2 The injected script never sees private keys

`services/chains/sui/injectedScript.ts` runs in the WebView (WebKit /
Chromium), not in Hermes. It owns the `window.__takumi_sui_wallet`
identity dApps bind to. The shim's only outbound channel is
`window.ReactNativeWebView.postMessage` — it never receives a key, a
signature suffix, or any byte derived from the seed. It receives
*signed* base64 blobs back from the native side and hands them to the
dApp.

This invariant is enforced by inspection — the shim is a closed,
hand-rolled IIFE — and by the `__wallet-standard-lint.ts` suite that
runs the script under a sandbox and asserts the wallet shape never
exposes `signer`, `keypair`, `privateKey`, or any field whose name
matches the redact `KEY_DENY` regex (`services/bridge/redact.ts:49`).

**Failure mode prevented:** A future "optimisation" that pre-computes
a signature inside the shim to avoid a bridge round-trip. Such an
optimisation would require the keypair to live in WebView JS memory,
where the dApp's own scripts could read it. Reject at PR review.

### 2.3 Cross-namespace trust is forbidden in `executeApproval`

A connect intent that arrives from an origin with an existing EVM
grant does NOT auto-grant Sui access. Mirror of
`SolanaAdapter:303-305`. The Sui adapter's `handleConnect` reads
`PermissionStore` grants filtered by `chainId.startsWith("sui:")`
(`pickSuiWalletForOrigin`); EVM grants do not surface in that list.

Silent reconnect (`standard:connect({silent:true})`) returns `4100`
when no Sui grant exists for the origin, regardless of the origin's
EVM history.

**Failure mode prevented:** A reviewer who folds the "find any active
grant for origin" predicate into a single helper across namespaces.
The natural shape of that helper would surface EVM grants on Sui
queries. The current per-namespace prefix-filter pattern is
intentional and load-bearing.

## 3. Carryover gates (no Sui-specific code; documentation only)

- **TWV-2026-013 (origin pinning).** `DappBridge.dispatch:204-215`
  rejects any request whose declared origin host disagrees with the
  tracked top-frame host. Sui requests inherit this for free —
  sub-frame messages (CVE-2020-6506-class XSS) cannot impersonate the
  top origin under this check.
- **TWV-2026-015 (session nonce).** Same. The Sui shim reads
  `window.__takumi_sui_nonce` at every request and stamps it onto the
  outbound message; the bridge's `acceptedNonces` ring at
  `services/bridge/DappBridge.ts:64-66` validates against any
  recently-issued nonce.
- **TWV-2026-064 (fullscreen disabled).** `app/dapps-browser.tsx:262-279`
  neutralises the JS fullscreen API before any dApp script runs. Sui
  inherits.

## 4. `eth_sign` non-equivalent

Sui has no analogue of `eth_sign`'s blank-cheque-signature footgun.
`personal_sign` is `sui:signPersonalMessage`, which always carries a
`PersonalMessage` intent prefix `[0x03, 0x00, 0x00]`. There is no way
to coerce `sui:signPersonalMessage` into signing a transaction digest.

Therefore `HARD_REJECT_METHODS` in
`services/bridge/DappBridge.ts:21` does **not** need a Sui entry.
TWV-2026-007's mitigation (hard-reject) does not have a Sui analogue
because the failure mode it mitigates does not exist on Sui.

If a future Sui Wallet Standard extension ships a `sui:signRaw` /
`sui:signDigest` method that bypasses the intent prefix, it MUST be
hard-rejected at the bridge in `HARD_REJECT_METHODS`. Document the
extension's name and its intent-prefix bypass in the new note.

## 5. What must cite this gate on PR review

A PR reviewer blocks and requires a TWV-2026-YYY citation in the PR
description for any change that:

- Adds a new code path that signs a Sui transaction or message OUTSIDE
  `services/chains/sui/signer.ts::installSuiSigner` ⇒
  `getSuiSignerForWallet` (the single dwell site). New tooling (agent
  executors, scheduled jobs) MUST go through `installSuiSigner`, not
  the keystore directly.
- Returns Sui keypair material from a public helper. This includes a
  helper that hands callers an `Ed25519Keypair` instance whose private
  half is recoverable, or that surfaces the parsed output of any
  seed-derivation path outside the dwell function.
- Adds cross-namespace fallback to `pickSuiWalletForOrigin` or any
  other helper that selects a wallet for a Sui connect, e.g. "if no
  Sui grant exists, fall through to the most-recent EVM grant for the
  origin". This is the cross-namespace-trust failure mode in §2.3.
- Caches a keypair, signature, or message in
  `services/chains/sui/injectedScript.ts` — including a "performance"
  optimisation that pre-builds a signed blob in the shim. Any such
  cache violates §2.2.
- Adds a `sui:` method to `HARD_REJECT_METHODS` (intentional) or
  removes one already there (regression).

Any of the above requires a signed-off TWV-2026-YYY entry in the PR
description and a security-reviewer approval on the diff.

## 6. Verification matrix

| Invariant | Verified by |
|---|---|
| §2.1 single dwell site | `services/chains/sui/signer.ts` resolves `walletKitRegistry.get("sui")` once. PR-review gate (§5). |
| §2.2 shim never sees keys | `services/chains/sui/__wallet-standard-lint.ts` asserts no field name matches `KEY_DENY`. Manual code review of the IIFE before merge. |
| §2.3 cross-namespace trust forbidden | `SuiAdapter.test.ts` cross-namespace-trust test: seed an EVM grant for origin O, fire `standard:connect({silent:true})` namespace=`sui`, expect `4100`. |
| TWV-2026-013 (origin pin) | Bridge integration test (already exists for Solana; extend to Sui). |
| TWV-2026-015 (nonce) | Bridge integration test (existing). |
| `eth_sign` non-equivalence | This note's §4 — no code change. |

## 7. Related gates

- **TWV-2026-070** — Solana-signer single dwell site
  (`65_solana_signer_design_note.md`). The Sui invariants in §2.1 are
  the Sui-shaped extension of the same discipline; the two notes are
  intentionally adjacent so reviewers see them as a matched pair.
- **TWV-2026-013 / 015 / 064** — generic browser-layer gates the Sui
  bridge inherits (§3 above).
- **TWV-2026-007** — `eth_sign` hard-reject. No Sui analogue (§4).
- **TWV-2026-XXX** — wallet-kit `getSuiSignerForWallet` dwell site,
  owned by `docs/sui-chain-support-spec.md`. TWV-2026-YYY depends on
  TWV-2026-XXX shipping; until it does, `installSuiSigner`
  short-circuits behind `walletKitRegistry.has("sui")` and the bridge
  returns `-32603 "no Sui signer registered"`.

## 8. Out of scope

The following are intentionally deferred and not protected by
TWV-2026-YYY. New gates will be added when these land:

- **WalletConnect over Sui.** Future spec. Adds a second injection
  surface (no in-WebView shim; remote pairing via WC v2). Will need a
  TWV note describing how WC's session-establishment story interacts
  with `PermissionStore` grants.
- **zkLogin.** Different dwell site (no local secret), different
  injectee, different connect flow. New spec.
- **Multisig accounts.** Exposes one of N as the dApp-facing identity;
  signing fans out to other signers (out-of-band). The signer surface
  is fundamentally different from §2.1 and warrants its own note.
- **Sponsored-tx renderer.** The decoder annotates `sponsored=true`
  when `gasOwner !== sender`, but a richer renderer that lets the
  user inspect the sponsor's portion of the PTB will add a new
  approval-time decision surface. Track separately.

## 9. Cross-reference

- Source of truth for the invariants:
  - `services/chains/sui/SuiAdapter.ts` (`executeApproval` block).
  - `services/chains/sui/signer.ts` (`installSuiSigner`).
- Spec sections that drove the gate:
  - `docs/sui-dapp-bridge-spec.md` §11 (security invariants).
- Sibling dwell-site note (Solana):
  - `docs/wallet-security-task/65_solana_signer_design_note.md`.
- Carryover-gate notes:
  - `docs/wallet-security-task/18_webview_hardening_twv013_*` (TWV-2026-013).
  - `docs/wallet-security-task/19_injected_nonce_and_origin_twv015_*` (TWV-2026-015).

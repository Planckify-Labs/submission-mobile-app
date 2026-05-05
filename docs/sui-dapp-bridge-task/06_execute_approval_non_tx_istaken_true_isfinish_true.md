# Task 06 — `SuiAdapter.executeApproval` for connect / signMessage / signIn / switchNetwork

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §4.4 (rows: connect, signMessage, signIn, switchNetwork), §9 (permissions).

## Why this matters

These four kinds share the property of *not* needing a built `Transaction`
— they're either side-effect-only (switchNetwork rewrites a grant) or
sign a fixed-form input (personal message, SIWS). Landing them before
`signTransaction` (Task 07) lets the dApp browser ship an end-to-end
connect + sign-message demo without the PTB decoder being ready yet.

## Scope

Implement in `services/chains/sui/SuiAdapter.ts`'s `executeApproval`:

- **`connect`**: write `PermissionStore` grant `{ origin, walletAddress,
  chainId: "sui:<network>", grantedAt }`. Return per §4.4:
  `{ accounts: [{ address, publicKey, chains, features, label, icon }],
  chain: "sui:<network>" }`. Resolve `publicKey` from
  `getSuiSignerForWallet(wallet).getPublicKey().toRawBytes()`.
- **`signMessage`**: call `SuiSignerFns.signPersonalMessage(address, messageB64)`.
  Return `{ bytes: <base64 of original message>, signature: <base64 97-byte> }`.
- **`signIn`** (SIWS): use `payload.canonicalMessage` (patched by
  `SuiSiwsInspector` — Task 10), encode UTF-8 → base64, call
  `signPersonalMessage`. Return `{ account, signedMessage: <base64 utf8>,
  signature }`. **Do not re-derive the canonical message** — the
  inspector's output is the source of truth (§8.3).
- **`switchNetwork`**: rewrite the per-origin grant `chainId` from
  `sui:<from>` → `sui:<to>` via `PermissionStore`. Return `{ ok: true,
  chain: "sui:<to>" }`.
- Error mapping per Task 02 codes:
  - User reject → `4001`.
  - No grant on signMessage → `4100`.
  - SIWS canonical-message missing → `-32603`.

## Rules (non-negotiable)

- **`signIn` reads `canonicalMessage` from the inspector.** Re-deriving
  in two places is the SIWS-replay class of bug.
- **`switchNetwork` is a TakumiPay extension.** It is NOT part of Wallet
  Standard. dApps that don't know about it never call it; we expose it
  for the in-app address-bar network picker.
- **`connect` returns `publicKey` as raw `Uint8Array(32)`** — no flag
  byte, no base64. Wallet Standard contract.
- **Cross-namespace trust forbidden in connect.** Already enforced in
  `handleConnect` (Task 04); double-check in executeApproval too.
- **No `-32601` from this task.** Every kind here is implemented.

## Acceptance

- [ ] All four kinds round-trip end-to-end against a stubbed signer.
- [ ] User-reject path returns `4001` for each kind.
- [ ] SIWS execute path uses the inspector-patched canonical message
      verbatim — verified by stubbing the inspector to return a known
      string and asserting that exact bytes were signed.
- [ ] Permission grants land with the correct `chainId` shape.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `signTransaction` (Task 07).
- Sheet rendering (Tasks 11, 12).
- SIWS canonical-message derivation (Task 10).

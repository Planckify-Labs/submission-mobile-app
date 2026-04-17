# Task 09 — `SolanaSiwsInspector` + `SolanaSignInSheet` + signer extension

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.8, §10.1, §10.4 inv 1/2/9.

## Why this matters

SIWS is the first Wallet Standard feature with no EVM analog that
ships a user-visible sheet with structured auth fields. Domain
pinning (§10.4 inv 1) and address-mismatch rejection (inv 2) are
P0 security invariants — without them, a dApp can ask the user to
"sign in" with a different wallet's address, producing a portable
credential attack surface.

## Scope

- `services/bridge/inspectors/SolanaSiwsInspector.ts`:
  - `name: "solana.siws"`, `priority: 20`, `mode: "auto"`,
    `namespaces: ["solana"]`, `kinds: ["signIn"]`.
  - Runs `originHost(origin.url)` check against `payload.domain` —
    mismatch → patch annotation `danger: "SIWS domain mismatch"`.
  - `input.address && input.address !== activeWallet.address` →
    reject with `4100 "address mismatch"` **before** sheet renders.
  - `expirationTime ≤ issuedAt` → reject `-32602`.
  - `notBefore > now` → annotation `info: "Sign-in scheduled for future"`.
  - `expirationTime > 90 days from now` → annotation `warn:
    "Long-lived sign-in"`.
- `components/dapps-browser/approvals/SolanaSignInSheet.tsx`:
  - Renders domain, statement, URI, chain, nonce, issuedAt,
    expirationTime, resources as structured rows (not raw ABNF).
  - `<RiskBanner>` consumes inspector annotations.
  - Approve / Reject buttons → `ApprovalDecision`.
- `services/chains/solana/signer.ts::installSolanaSigner` — extend:
  - `handleSignIn(payload)` → builds bytes via `buildSiwsMessage`
    (Task 08), calls `signer.signMessage({ data: bytes })`, returns
    `{ account, signedMessage: bytes, signature, signatureType:
    "ed25519" }` per `SolanaSignInOutput`.
- `services/chains/solana/SolanaAdapter.ts::executeApproval` —
  `ApprovalKind="signIn"` branch dispatches to the signer.
- `bridge/renderers.ts` — register `SolanaSignInSheet` for `(kind:
  "signIn", namespace: "solana")`.
- **`BridgeEvent` redaction** — emit a `signIn` breadcrumb with only
  structural fields (domain, issuedAt, expirationTime); no signature
  bytes. Used by agent for "user signed into foo.xyz at T-30s" memory.

## Rules (non-negotiable)

- **Address mismatch rejects pre-sheet.** User never sees a sheet
  asking them to sign as a different address. Invariant 2.
- **Domain comes from `originHost(origin.url)`**, not from the
  WebView's current URL. Navigation mid-flight is caught by
  `DappBridge.onNavigate`; inspector reads the request-time origin.
- **We do not accept dApp-supplied signing bytes.** Signer constructs
  bytes from our own `buildSiwsMessage` output and signs those —
  never a dApp-provided `Uint8Array`.
- **Signature bytes never emitted on `BridgeEventBus`.** Redacted to
  structural fields only.

## Acceptance

- [ ] Phantom demo SIWS page: full round-trip, signature verifies
      server-side.
- [ ] Address-mismatch payload: adapter rejects `4100` before sheet.
- [ ] Homograph domain (`xn--n3h.com` vs punycode original): inspector
      patches `danger` annotation.
- [ ] `expirationTime` in the past: `-32602`.
- [ ] Sheet renders structured rows; no ABNF text visible.
- [ ] Emitted `BridgeEvent` contains no signature.

## Out of scope

- `siws.ts` builder (Task 08, done).
- SIWE on EVM — separate spec; `ApprovalKind="signIn"` reused then.

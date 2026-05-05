# Task 10 — `SuiSiwsInspector`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §8.3.

## Why this matters

SIWS (Sign-In-With-Sui) is structured login. The user must see a
canonical, human-readable message before signing — and that exact
message string is what the executeApproval (Task 06) signs. Two
derivations would be a replay-class bug; one canonical message in the
inspector keeps both paths honest.

## Scope

- `services/bridge/inspectors/SuiSiwsInspector.ts`:
  - Priority: 25.
  - Mode: auto.
  - Trigger: `intent.namespace === "sui" && intent.kind === "signIn"`.
  - Pure parser — no RPC.
  - Build canonical SIWS message string per §8.3 template:
    ```
    {domain} wants you to sign in with your Sui account:
    {address}

    {statement}

    URI: {uri}
    Version: {version}
    Chain: {chainId}
    Nonce: {nonce}
    Issued At: {issuedAt}
    Expiration Time: {expirationTime}
    Not Before: {notBefore}
    Request ID: {requestId}
    Resources:
    - {resources[0]}
    - ...
    ```
  - Patch `payload.canonicalMessage`.
  - Annotations:
    - `siws.domain-mismatch` (danger) — `payload.domain !==
      originKey(intent.origin.url)`.
    - `siws.expired` (danger) — `expirationTime < now`.
    - `siws.not-yet-valid` (warn) — `notBefore > now`.
- `services/bridge/inspectors/SuiSiwsInspector.test.ts`:
  - Canonical-message construction with full + partial fields.
  - Domain-mismatch fixture.
  - Expired fixture.
  - Not-yet-valid fixture.

## Rules (non-negotiable)

- **Inspector output is the single source of truth.** Task 06's
  executeApproval reads `payload.canonicalMessage` verbatim — never
  rebuilds.
- **`originKey` is the same helper the bridge uses for origin-pinning**
  (TWV-2026-013). Don't reinvent — import from
  `services/bridge/originKey.ts` (or wherever the Solana inspector
  imports it).
- **Optional fields render with the line omitted entirely**, not as
  empty values. EIP-4361 contract.

## Acceptance

- [ ] Canonical message bit-identical to a hand-crafted reference for
      a fixture with all fields populated.
- [ ] All three annotation types reachable.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- SIWS sheet rendering (Task 12).
- SIWS signing (Task 06).

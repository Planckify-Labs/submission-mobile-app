# Task 16 — EIP-7702 authorization UI + delegator allowlist enforcement

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-010, §7, §9

## Why this matters

EIP-7702 lets an EOA sign a single authorization tuple
(`chainId, address, nonce`) that rewires every future call to that address
through a delegate contract. A malicious delegate can sweep assets on every
incoming transfer. Multiple malicious delegators with high authorization
counts are already deployed (arXiv 2512.12174, DeFiHackLabs). A generic
signature prompt cannot convey "this REWIRES your entire account". The
project already ships `docs/eip7702-delegator-allowlist-spec.md` but the
allowlist is not enforced at the signing boundary — only at UI level.

## Scope

- Signer UI — add a distinct EIP-7702 authorization screen that replaces the
  generic typed-data prompt when the payload is a 7702 auth tuple. Copy MUST
  include "This REWIRES your wallet. All future calls to your address will
  run code at CONTRACT." plus the delegate address, chainId, and nonce from
  the tuple.
- Signing boundary (`services/walletService.ts` or the 7702-specific signer
  referenced in `docs/eip7702-delegator-allowlist-spec.md` — see spec §8) —
  enforce the signed allowlist at the signing function itself, not only in
  the UI. A 7702 signature for an unlisted delegate must fail at the signer,
  so a bypass of the UI (deeplink, bridge, agent) cannot reach the key.
- Out-of-allowlist delegates must be hard-blocked OR require the user to
  type a typed confirmation phrase (spec §6 TWV-2026-010). Implement the
  hard-block default; typed-phrase path is out of scope.
- Bytecode sniff — before presenting the prompt, fetch the delegate bytecode
  via the pinned RPC (see spec §9) and refuse authorizations whose prologue
  contains `SELFDESTRUCT` or calls an unknown fallback.
- Wallet home — show current delegation status (delegated to X / not
  delegated) with a one-tap "Revoke delegation" action that signs a 7702
  authorization to the zero address.

## Rules (non-negotiable)

- Allowlist enforcement MUST live at the signing function. A UI-only check
  is not sufficient.
- The authorization screen MUST NOT be reachable via a generic
  `eth_signTypedData` fall-through. 7702 payloads are a distinct variant.
- Revoke-delegation MUST use the same allowlist-exempt zero-address path so
  the user is never locked into a compromised delegate.
- The allowlist file MUST be versioned and reviewed — see spec
  `docs/eip7702-delegator-allowlist-spec.md`.

## Acceptance

- [ ] 7702 auth tuple renders the dedicated screen, not the typed-data screen.
- [ ] Signing a 7702 auth for an out-of-allowlist delegate fails at the
      signer with a stable error code, even when the UI is bypassed.
- [ ] Delegates whose bytecode prologue contains `SELFDESTRUCT` are rejected
      with a distinct error.
- [ ] Home screen shows current delegation status and can submit a revoke
      (zero-address) authorization.
- [ ] Unit tests cover: allowed delegate, disallowed delegate, zero-address
      revoke, malformed tuple.
- [ ] pnpm check:syntax passes.

## Out of scope

- Adding new entries to the delegator allowlist (governance, not code).
- Typed-phrase override for out-of-allowlist delegates.
- Batch-authorization (`authorization_list`) UX for smart-account setups.

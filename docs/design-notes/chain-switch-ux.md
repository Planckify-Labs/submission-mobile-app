# Chain switch UX — TWV-2026-017

**Owner:** mobile-app · **Spec ref:**
`docs/wallet-security-vulnerabilities-spec.md` TWV-2026-017.

## The rule

Every `wallet_switchEthereumChain` request renders a fresh approval
sheet. Grants for prior chains never short-circuit a fresh prompt —
there is **no** persisted "always approve switches for this origin"
state, anywhere in the codebase.

The signer UI shows the active chain (e.g. *"Signing on: Base"*) in the
header on every signature prompt. The chainId rendered in that header
comes from the registry — `services/chains/evm/signingChainId.ts` — not
from RPC `eth_chainId`. (See TWV-2026-016 / Task 07.)

## Audit (2026-04-16)

`grep -rn "switchChain.*approve\|wallet_switchEthereumChain"` against
`services/permissions/` and `services/bridge/` returned zero hits for
auto-approve / always-approve / cached-decision branches. The single
hit is the EVM adapter's `case "wallet_switchEthereumChain"` arm in
`services/chains/evm/EvmAdapter.ts`, which routes unconditionally to
`needsApproval(makeIntent(...))`.

The permission store
(`services/permissions/store.ts`,
`services/permissionGrantStore.ts`) only persists EIP-2255 grants for
account / chain access on connect; no "always approve switches" flag is
defined or referenced.

## Back-to-back switch + sign

A drainer pattern is `switchEthereumChain → signTypedData_v4` within
the same gesture. The signer sheet's header MUST always render the
chain banner — even when the immediately-prior approval was a switch
to that chain. Implementation lives in the chain-id pin
(`signingChainId.ts`); the sheet reads it on every render, so
the back-to-back case is covered by construction.

## Review gate

Any PR that touches the chain-switch approval flow MUST cite
TWV-2026-017 and re-confirm:

1. The approval is per-call (no caching).
2. The signer sheet header still renders the chain.
3. The chainId source is the registry, not RPC `eth_chainId`.

A `// TWV-2026-017` comment lives in `EvmAdapter.ts` next to the
`wallet_switchEthereumChain` arm — preserve it on refactors.

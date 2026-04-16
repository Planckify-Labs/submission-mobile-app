# Multi-RPC consensus for critical reads — TWV-2026-028

**Owner:** mobile-app · **Spec ref:**
`docs/wallet-security-vulnerabilities-spec.md` TWV-2026-028.

## Audit (2026-04-16)

`services/rpc/MultiProvider.ts` exists and ships failover + rate
limiting + dedup. It does **not** today implement quorum / consensus
across independent providers — current behaviour falls back on a
priority-ordered list and returns the first successful response.

Until the consensus pass lands, the rules below stand as a review
gate (`TWV-2026-028`). Any new critical-read path that doesn't honour
them is a merge-block.

## The critical-read set

A "critical read" is any RPC value rendered in a signing sheet or
used to gate a safety signal. These MUST be cross-checked against ≥
2 independent providers:

- Native-token balance shown on send-confirm.
- ERC-20 / ERC-721 allowance for permit / approval UX.
- `chainId` (always sourced from the registry —
  `services/chains/evm/signingChainId.ts` — never RPC).
- `eth_estimateGas` when its result gates a warning banner (e.g.
  "this tx will revert").

Non-critical reads (token metadata, historical balances on portfolio
tabs, gas-price ticker) may use the priority-ordered first-response
path.

## Mismatch policy

When two providers disagree on a critical read:

1. Surface a warning banner on the signing sheet — never silently
   pick one.
2. Fall back to the **trusted default** RPC, NOT the user-added
   custom RPC.
3. Log the mismatch via `bridgeEventBus` for triage. Payload includes
   chainId + method, never the user's address.

## Custom RPC handling

User-added RPCs (added via `wallet_addEthereumChain` after the
chainid.network allowlist check in TWV-2026-049) carry a persistent
"Custom — unverified" banner. They never satisfy the consensus
quorum for a critical read; they may participate as a third opinion,
but the quorum is always two trusted defaults.

## Write-path posture

`eth_sendRawTransaction` for swap / setApprovalForAll routes through
the Flashbots Protect / MEV Blocker private mempool where available
(see TWV-2026-050 / Task 28). Falls back to the public mempool only
for chains without a private relay.

## Review gate

Any PR that adds an RPC method to the critical-read set MUST cite
TWV-2026-028 and either:

- prove the method already routes through `MultiProvider` with
  consensus, OR
- file a follow-up task to wire it before the next release cut.

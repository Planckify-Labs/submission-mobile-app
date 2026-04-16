# Task 07 — Use registry chainId (not RPC `eth_chainId`) for signing

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-016, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

A malicious `wallet_addEthereumChain` can claim `chainId=1` while the
RPC URL belongs to the attacker. If the wallet asks that RPC
`eth_chainId` and trusts the answer, the attacker can proxy reads to
real mainnet (so everything looks live) while collecting a mainnet-
signed transaction and replaying — or dropping — it at will. The spec
names `services/chains/evm/chainStore.ts` and
`services/chains/registry.ts` as the governing surfaces. §9 "DApp
browser / EIP-1193" row: "Chain-ID used for signing is from the
internal registry, never RPC-reported."

## Scope

1. Audit every code path that supplies `chainId` to a signer — Viem
   `signTransaction`, EIP-712 domain, EIP-1559 tx construction, and
   the agent's tx-execution paths. The source of truth must be the
   chain entry the user confirmed at add-chain time, persisted in
   `services/chains/evm/chainStore.ts`.
2. Remove or quarantine any call that reads `eth_chainId` and feeds
   it back into a signed payload. Keep `eth_chainId` available for
   read-only UX (e.g. telling the user "this RPC claims chain X"),
   but explicitly annotate at the call site that the return value
   must not flow into signing.
3. Add a mismatch detector: if RPC-reported `eth_chainId` differs
   from the registry chainId on a live connection, surface a warning
   banner in the dApp browser header and refuse further signatures
   on that chain until the user re-adds it.
4. Unit test in `services/chains/evm/chainStore.test.ts` (create if
   absent) that constructs a mocked RPC returning a wrong `eth_chainId`
   and asserts the signing-path chainId is still the registry value.

## Rules (non-negotiable)

- **Registry is the single source of chainId for signing.** Every
  Viem / EIP-712 / EIP-1559 construction call reads from chainStore.
- **RPC `eth_chainId` is read-only telemetry.** Never rewrites the
  stored chain entry.
- **Mismatch is user-visible.** Never silent; the user sees a banner
  and has a re-add path (aligns with §7.1.1 — no feature removal).
- **Chain list preserved (§7.1.7).** Every chain currently active in
  chainStore keeps working; no user-added chain is dropped.

## Acceptance

- [ ] Grep shows no signing-path code path that sources chainId from
      `eth_chainId`.
- [ ] `services/chains/evm/chainStore.ts` exposes a single
      `getSigningChainId(chainKey)` (or equivalent) used everywhere.
- [ ] Unit test covers: registry returns 1, RPC returns 137 — signed
      tx encodes chainId 1, and a mismatch banner is raised.
- [ ] Manual regression: send native token + ERC-20 on at least one
      mainnet and one L2; chain-switch between them and re-sign; all
      flows unchanged from user's POV.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Explorer-URL allowlisting for `wallet_addEthereumChain` —
  TWV-2026-049 (task 13).
- Blocking silent chain switches before a signature — TWV-2026-017
  (Phase 3, task 36).
- Multi-RPC consensus on reads — TWV-2026-028 (Phase 3, task 41).

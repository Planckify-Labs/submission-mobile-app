# Task 08 — Full Permit/Permit2 decoding in signer UI

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-008, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

ERC-2612 `permit()` and Uniswap's Permit2 grant spending allowance via
an off-chain signature — no gas fee, "just a signature" on most wallet
UIs. ScamSniffer / SlowMist have tracked $35M in a single incident
plus an ongoing drainer category. The spec points to existing
`services/decoders/erc2612.ts` and `services/decoders/permit2.ts`: the
question is whether every Permit2 variant is covered and whether the
decoder output is surfaced unconditionally in the signer UI. §9
"Signatures" row: "Permit / Permit2 decoded with spender, amount (with
unlimited warning), deadline."

## Scope

1. Audit `services/decoders/erc2612.ts` and
   `services/decoders/permit2.ts` for coverage of: ERC-2612 `Permit`,
   Permit2 `PermitSingle`, `PermitBatch`, `PermitTransferFrom`,
   `PermitBatchTransferFrom`, `AllowanceTransfer`. Fill any gap.
2. In the signer UI flow (any component reached from a
   `eth_signTypedData_v4` approval intent), gate "Sign" behind a
   render of: token symbol, spender (with known-contract name lookup
   if available), amount (flag `Unlimited` for `2^256-1` or values
   `>= type(uint256).max / 2`), and deadline in local time.
3. Add a prominent red banner when `spender` is not in a curated
   known-safe list (Uniswap universal router, 1inch, CoW, etc.) or
   when the contract is freshly deployed (< 30 days — deferred data
   source; for this task, ship the banner when spender is simply
   unknown to the allowlist).
4. Extend the decoder tests (`services/decoders/erc2612.test.ts`,
   `services/decoders/permit2.test.ts`) to cover all variants and a
   malformed-typed-data fixture.

## Rules (non-negotiable)

- **Decoder runs unconditionally.** No "advanced-user skip" path.
  Every `eth_signTypedData_v4` that matches a Permit shape surfaces
  the decoded fields.
- **Unlimited amount is flagged.** Threshold is `>= type(uint256).max / 2`;
  display string is "Unlimited (full balance)".
- **Unknown spender is red-banner, not silent.** Signable-tx parity
  (§7) — the user can still proceed; we warn, we do not hard-block.
- **No regression on non-Permit typed data.** Login-style
  `eth_signTypedData_v4` (e.g. SIWE) keeps rendering as before.

## Acceptance

- [ ] All Permit2 variants listed above decode successfully on known
      fixtures (add fixtures under the existing `*.test.ts` files).
- [ ] Signer UI renders token / spender / amount / deadline for every
      Permit-shape signature; "Unlimited" label appears for
      `type(uint256).max`.
- [ ] Red banner appears when spender is outside the known-safe list;
      disappears when the list is updated to include it.
- [ ] Manual regression: sign a real Uniswap Permit2 approval on a
      testnet — decoded UI matches the dApp's own preview.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Cool-down timer on Permit / Permit2 / `setApprovalForAll` — in §9
  but tracked with `setApprovalForAll` work (TWV-2026-009, task 15).
- Scam-domain feed integration — TWV-2026-051 (Phase 2, task 29).
- "Pending permits" revocation view — partially overlaps task 29;
  a surface-only link from this task to a placeholder screen is fine.
- Indexing Permit2 allowances in `hooks/queries/useTokenApprovals.ts`
  (named in the spec as a follow-on; out of scope for Phase 1).

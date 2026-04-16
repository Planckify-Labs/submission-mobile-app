# Task 45 — Always display EIP-712 `domain` fields

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-012, §7, §9

## Why this matters

A typed-data signature whose `domainSeparator` is reused across
contract deployments can be replayed in a different context. The
only robust defence on the wallet side is to show the user the full
`EIP712Domain` — `name`, `version`, `chainId`, `verifyingContract` —
and to refuse (or loudly warn on) a `chainId` that doesn't match the
active chain. The spec calls out the decoders in `services/decoders/`
as the code path; this task verifies the signer UI actually surfaces
the fields and that chainId-mismatch is blocked.

## Scope

Audit + small UI spec task:

- Walk the existing EIP-712 signer UI flow end to end (see spec:
  signer UI, decoders in `services/decoders/`). Enumerate what is
  shown and what is hidden today in
  `docs/design-notes/eip712-domain-display.md`.
- Specify the required UI contract:
  - Always render `domain.name`, `domain.version`, `domain.chainId`,
    and `domain.verifyingContract` above the fold of the signing
    sheet — not behind a "details" expander.
  - If `domain.chainId` differs from the registry-derived active
    chainId (pairs with Task 07, TWV-2026-016), the signer refuses
    and surfaces a chain-mismatch error. Pre-merge fallback: a
    prominent red banner, but refusal is preferred.
  - `verifyingContract` is displayed with known-contract name lookup
    where available (Uniswap, Permit2, 1inch, Safe); unknowns render
    as the full address plus a "fresh contract" warning if
    on-chain < 30 days.
- Add regression tests covering chainId-mismatch refusal and the
  minimum set of visible domain fields.
- Cross-reference Task 08 (Permit/Permit2 decoding, TWV-2026-008) —
  domain display is the baseline that Permit decoding sits on top of.
- Flag TWV-2026-012 as a review gate on any signer UI change.

## Rules (non-negotiable)

- All four domain fields are above the fold; none are hidden behind
  a disclosure toggle.
- chainId-mismatch blocks signing; it is not a soft warning.
- Known-contract lookup is cached from a pinned list bundled at
  build time; it never fetches at signing time.

## Acceptance

- [ ] `docs/design-notes/eip712-domain-display.md` landed with the
      current-state audit and the required UI contract.
- [ ] Signer UI enumerates the four domain fields above the fold
      (or deltas are filed as follow-ups).
- [ ] Regression tests cover chainId-mismatch and minimum-fields
      display.
- [ ] Cross-reference to Task 07 (registry chainId) and Task 08
      (Permit decoding) recorded in the note.
- [ ] PR template gains a "touches EIP-712 signer UI? cite
      TWV-2026-012" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Full calldata-decoding redesign (Task 08, TWV-2026-008).
- Known-contract name dataset curation beyond the current bundle.
- EIP-712 schema validation beyond `domain` field presence (decoders
  already cover types).

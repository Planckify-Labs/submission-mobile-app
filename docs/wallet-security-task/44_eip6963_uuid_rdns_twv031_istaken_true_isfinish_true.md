# Task 44 — Stable `uuid` + `rdns` for EIP-6963 announcement

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-031, §7, §9

## Why this matters

EIP-6963 lets multiple wallets announce themselves to a dApp via
window events. A malicious wallet that announces the same user-visible
`name` and `icon` as a legitimate one can get picked up by dApps that
select by name — signatures go through the attacker. The defence is
a stable, unique `uuid` and a reverse-DNS `rdns` matching our own
domain, so any dApp that selects by `rdns` gets the real wallet.

## Scope

Audit + design-note task:

- Read `services/chains/evm/eip6963.ts` (file named in spec §6
  applicability note) and confirm:
  - `uuid` is a stable, build-time constant — not regenerated per
    launch, per wallet, or per-origin.
  - `rdns` is `com.takumiaiwallet.mobile` (or equivalent exact
    reverse-DNS of our owned domain).
  - `name` and `icon` are stable strings bundled at build time, not
    user-editable, not fetched at runtime.
- If the module is a stub or the values drift from the rule above,
  record the delta and file the fix as a follow-up referencing
  TWV-2026-031.
- Write `docs/design-notes/eip6963-identity.md` specifying the
  invariants and the rotation policy (the `uuid` stays stable
  across releases; `rdns` never changes).
- Cover the "announce-inbound" case: if we ever operate as a dApp
  (agent-executor calling out), provider selection must be by
  `rdns`, never by `name`, and any announced SVG icon must be
  sanitised before rendering. File follow-ups if that code path
  exists.
- Flag TWV-2026-031 as a review gate on any PR touching EIP-6963
  announce/listen code or the bundle ID.

## Rules (non-negotiable)

- `uuid` is a pinned UUIDv4 baked into source; no runtime generation.
- `rdns` matches the owned domain and never drifts from the package
  name / bundle ID.
- Inbound provider selection (if ever implemented) is always by
  `rdns`, not `name`.
- SVG icons received from other providers are sanitised before any
  rendering — SVG XSS is a documented risk.

## Acceptance

- [ ] Audit of `services/chains/evm/eip6963.ts` recorded in
      `docs/design-notes/eip6963-identity.md`.
- [ ] `uuid` and `rdns` values documented in the note; deltas from
      the rule filed as follow-up tasks.
- [ ] Note covers the (hypothetical) inbound-announce path and
      specifies rdns-over-name selection + SVG sanitisation.
- [ ] PR template gains a "touches EIP-6963 announce/listen? cite
      TWV-2026-031" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Adding EIP-6963 support if the module is a stub (file a follow-up;
  this task is design + audit).
- Implementing SVG sanitisation for inbound icons (only needed if
  the inbound path exists).
- Icon asset redesign.

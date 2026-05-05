# Task 13 — Append Sui rows to `components/dapps-browser/approvals/renderers.ts`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §3.2 (renderers row), §7.2.

## Why this matters

Sheets exist (Tasks 11, 12) but are unreachable until the renderer
registry routes intents to them. This is the trivial last step before
the sheets are user-visible — gated by Task 14's boot guard from
actually firing.

## Scope

- Append four entries to `components/dapps-browser/approvals/renderers.ts`
  per §7.2:
  ```ts
  { canHandle: (i) => i.namespace === "sui" && i.kind === "signIn",          Component: SuiSignInSheet },
  { canHandle: (i) => i.namespace === "sui" && i.kind === "signMessage",     Component: SuiSignPersonalMessageSheet },
  { canHandle: (i) => i.namespace === "sui" && i.kind === "signTransaction", Component: SuiTransactionSheet },
  { canHandle: (i) => i.namespace === "sui" && i.kind === "switchNetwork",   Component: SuiSwitchNetworkSheet },
  ```
- Verify (no code change needed): the `connect` row at `:30-33` is
  namespace-agnostic and covers Sui via the kit's
  `formatConnectChipLabel` / `brandColor` / `requireBiometricForConnect`
  hooks (§3.2).
- Verify: the `via: "agent"` row at `:21-24` (`AgentCardRenderer`)
  already covers agent-submitted Sui intents.

## Rules (non-negotiable)

- **Order matters.** Rows are scanned top-to-bottom; first-match wins.
  Append after Solana rows so the agent-card row at `:21-24` and the
  connect row at `:30-33` keep their precedence.
- **No rename of `evmRenderers`.** Misleading name (it holds Solana too)
  but renaming is out of scope per §7.2.
- **No `connect` row for Sui.** The shared row already handles it.

## Acceptance

- [ ] Four new entries present in registry.
- [ ] Trivial unit test: each `kind` in `["signIn", "signMessage",
      "signTransaction", "switchNetwork"]` resolves to the right
      Component for `namespace: "sui"`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- The sheets themselves (Tasks 11, 12).
- Renaming `evmRenderers`.

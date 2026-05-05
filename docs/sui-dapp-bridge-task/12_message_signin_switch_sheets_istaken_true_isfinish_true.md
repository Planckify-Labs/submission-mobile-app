# Task 12 — `SuiSignPersonalMessageSheet.tsx`, `SuiSignInSheet.tsx`, `SuiSwitchNetworkSheet.tsx`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §7.1 (rows for signMessage / signIn / switchNetwork), §8.3 (SIWS canonical).

## Why this matters

The remaining three sheets are mostly mirror-of-Solana work. Bundling
them in one task saves one round-trip of review and keeps the visual
language consistent across the three.

## Scope

- `components/dapps-browser/approvals/SuiSignPersonalMessageSheet.tsx`:
  - Reads `intent.payload: SuiSignPersonalMessagePayload`.
  - Two display modes via `payload.display`:
    - `"utf8"` — render decoded text in a monospace block.
    - `"base64"` — render the base64 string with a "show raw bytes"
      toggle (default-collapsed).
  - Mirror `SolanaSignMessageSheet.tsx` layout primitives.
- `components/dapps-browser/approvals/SuiSignInSheet.tsx`:
  - Reads `intent.payload: SuiSignInPayload` + `payload.canonicalMessage`
    (patched by `SuiSiwsInspector` — Task 10).
  - Renders the canonical message verbatim.
  - Domain-pinning warning band when `siws.domain-mismatch` annotation
    present.
  - Expiry / not-yet-valid bands per annotation.
  - Mirror `SolanaSignInSheet.tsx`.
- `components/dapps-browser/approvals/SuiSwitchNetworkSheet.tsx`:
  - Reads `intent.payload: SuiSwitchNetworkPayload`.
  - Two-row picker (`from → to`) with network chips.
  - Mirror `SolanaSwitchClusterSheet.tsx`.
- Snapshot tests for each: one happy fixture + one with-warnings fixture.

## Rules (non-negotiable)

- **SIWS sheet renders the inspector's `canonicalMessage`** — never
  re-derive (replay-class bug).
- **`utf8` vs `base64` discriminator is `payload.display`** — the
  inspector / heuristic decides; the sheet does not auto-detect.
- **Switch-network sheet shows network chips, not RPC URLs.** RPC URLs
  are an internal detail.
- **Match Solana sheet primitives** — same chip / banner / button
  components.

## Acceptance

- [ ] Three sheets compile, render in storybook / dev route.
- [ ] Six snapshot fixtures (two per sheet) green.
- [ ] `pnpm check:syntax` passes; `pnpm biome:check` clean.

## Out of scope

- Renderer registration (Task 13).
- `SuiWatchTokenSheet` — not in milestone (§7.1 last row).
